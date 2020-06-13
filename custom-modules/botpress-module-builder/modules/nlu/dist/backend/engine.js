"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

var CacheManager = _interopRequireWildcard(require("./cache-manager"));

var _posTagger = require("./language/pos-tagger");

var _modelService = require("./model-service");

var _predictPipeline = require("./predict-pipeline");

var _slotTagger = _interopRequireDefault(require("./slots/slot-tagger"));

var _patternsUtils = require("./tools/patterns-utils");

var _trainingPipeline = require("./training-pipeline");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const trainDebug = DEBUG('nlu').sub('training');

class Engine {
  // NOTE: removed private in order to prevent important refactor (which will be done later)
  constructor(defaultLanguage, botId) {
    this.defaultLanguage = defaultLanguage;
    this.botId = botId;

    _defineProperty(this, "predictorsByLang", {});

    _defineProperty(this, "modelsByLang", {});
  }

  static provideTools(tools) {
    Engine.tools = tools;
  }

  async train(intentDefs, entityDefs, languageCode, trainingSession) {
    trainDebug.forBot(this.botId, `Started ${languageCode} training`);
    const list_entities = entityDefs.filter(ent => ent.type === 'list').map(e => {
      return {
        name: e.name,
        fuzzyTolerance: e.fuzzy,
        sensitive: e.sensitive,
        synonyms: _lodash.default.chain(e.occurrences).keyBy('name').mapValues('synonyms').value()
      };
    });
    const pattern_entities = entityDefs.filter(ent => ent.type === 'pattern' && (0, _patternsUtils.isPatternValid)(ent.pattern)).map(ent => ({
      name: ent.name,
      pattern: ent.pattern,
      examples: [],
      // TODO add this to entityDef
      matchCase: ent.matchCase,
      sensitive: ent.sensitive
    }));

    const contexts = _lodash.default.chain(intentDefs).flatMap(i => i.contexts).uniq().value();

    const input = {
      botId: this.botId,
      trainingSession,
      languageCode,
      list_entities,
      pattern_entities,
      contexts,
      intents: intentDefs.filter(x => !!x.utterances[languageCode]).map(x => ({
        name: x.name,
        contexts: x.contexts,
        utterances: x.utterances[languageCode],
        slot_definitions: x.slots
      }))
    }; // Model should be build here, Trainer should not have any idea of how this is stored
    // Error handling should be done here

    const model = await (0, _trainingPipeline.Trainer)(input, Engine.tools);
    model.hash = (0, _modelService.computeModelHash)(intentDefs, entityDefs);

    if (model.success) {
      trainingSession && Engine.tools.reportTrainingProgress(this.botId, 'Training complete', { ...trainingSession,
        progress: 1,
        status: 'done'
      });
      trainDebug.forBot(this.botId, `Successfully finished ${languageCode} training`);
    }

    return model;
  }

  modelAlreadyLoaded(model) {
    if (!(model === null || model === void 0 ? void 0 : model.languageCode)) {
      return false;
    }

    const lang = model.languageCode;
    return !!this.predictorsByLang[lang] && !!this.modelsByLang[lang] && !!this.modelsByLang[lang].hash && !!model.hash && this.modelsByLang[lang].hash === model.hash;
  }

  async loadModels(models) {
    // note the usage of mapSeries, possible race condition
    return Promise.mapSeries(models, model => this.loadModel(model));
  }

  async loadModel(model) {
    if (this.modelAlreadyLoaded(model)) {
      return;
    }

    if (!model.data.output) {
      const intents = await (0, _trainingPipeline.ProcessIntents)(model.data.input.intents, model.languageCode, model.data.artefacts.list_entities, Engine.tools);
      model.data.output = {
        intents
      };
    }

    this._warmEntitiesCaches(_lodash.default.get(model, 'data.artefacts.list_entities', []));

    this.predictorsByLang[model.languageCode] = await this._makePredictors(model);
    this.modelsByLang[model.languageCode] = model;
  }

  _warmEntitiesCaches(listEntities) {
    for (const entity of listEntities) {
      if (!entity.cache) {
        // when loading a model trained in a previous version
        entity.cache = CacheManager.getOrCreateCache(entity.entityName, this.botId);
      }

      if (CacheManager.isCacheDump(entity.cache)) {
        entity.cache = CacheManager.loadCacheFromData(entity.cache, entity.entityName, this.botId);
      }
    }
  }

  async _makePredictors(model) {
    const {
      input,
      output,
      artefacts
    } = model.data;
    const tools = Engine.tools;

    if (_lodash.default.flatMap(input.intents, i => i.utterances).length <= 0) {
      // we don't want to return undefined as extraction won't be triggered
      // we want to make it possible to extract entities without having any intents
      return { ...artefacts,
        contexts: [],
        intents: [],
        pattern_entities: input.pattern_entities
      };
    }

    const {
      ctx_model,
      intent_model_by_ctx,
      oos_model
    } = artefacts;
    const ctx_classifier = ctx_model ? new tools.mlToolkit.SVM.Predictor(ctx_model) : undefined;

    const intent_classifier_per_ctx = _lodash.default.toPairs(intent_model_by_ctx).reduce((c, [ctx, intentModel]) => ({ ...c,
      [ctx]: new tools.mlToolkit.SVM.Predictor(intentModel)
    }), {});

    const oos_classifier = (0, _posTagger.isPOSAvailable)(model.languageCode) ? new tools.mlToolkit.SVM.Predictor(oos_model) : undefined;
    const slot_tagger = new _slotTagger.default(tools.mlToolkit);
    slot_tagger.load(artefacts.slots_model);
    const kmeans = (0, _trainingPipeline.computeKmeans)(output.intents, tools); // TODO load from artefacts when persisted

    return { ...artefacts,
      ctx_classifier,
      oos_classifier,
      intent_classifier_per_ctx,
      slot_tagger,
      kmeans,
      pattern_entities: input.pattern_entities,
      intents: output.intents,
      contexts: input.contexts
    };
  }

  async predict(sentence, includedContexts) {
    const input = {
      defaultLanguage: this.defaultLanguage,
      sentence,
      includedContexts
    }; // error handled a level highr

    return (0, _predictPipeline.Predict)(input, Engine.tools, this.predictorsByLang);
  }

}

exports.default = Engine;

_defineProperty(Engine, "tools", void 0);
//# sourceMappingURL=engine.js.map