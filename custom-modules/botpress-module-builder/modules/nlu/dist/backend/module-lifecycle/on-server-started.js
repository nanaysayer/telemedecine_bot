"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getOnSeverStarted = getOnSeverStarted;
exports.initializeLanguageProvider = void 0;

var _bluebirdRetry = _interopRequireDefault(require("bluebird-retry"));

var _lodash = _interopRequireDefault(require("lodash"));

var _engine = _interopRequireDefault(require("../engine"));

var _duckling_extractor = require("../entities/duckling_extractor");

var _languageProvider = _interopRequireDefault(require("../language/language-provider"));

var _posTagger = require("../language/pos-tagger");

var _modelService = require("../model-service");

var _predictPipeline = require("../predict-pipeline");

var _trainSessionService = require("../train-session-service");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const initializeLanguageProvider = async (bp, state) => {
  const globalConfig = await bp.config.getModuleConfig('nlu');

  try {
    const languageProvider = await _languageProvider.default.initialize(globalConfig.languageSources, bp.logger);
    const {
      validProvidersCount,
      validLanguages
    } = languageProvider.getHealth();
    const health = {
      isEnabled: validProvidersCount > 0 && validLanguages.length > 0,
      validProvidersCount,
      validLanguages
    };
    state.languageProvider = languageProvider;
    state.health = health;
  } catch (e) {
    if (e.failure && e.failure.code === 'ECONNREFUSED') {
      bp.logger.error(`Language server can't be reached at address ${e.failure.address}:${e.failure.port}`);

      if (!process.IS_FAILSAFE) {
        process.exit();
      }
    }

    throw e;
  }
};

exports.initializeLanguageProvider = initializeLanguageProvider;

function initializeEngine(bp, state) {
  const tools = {
    partOfSpeechUtterances: (tokenUtterances, lang) => {
      const tagger = (0, _posTagger.getPOSTagger)(lang, bp.MLToolkit);
      return tokenUtterances.map(_posTagger.tagSentence.bind(this, tagger));
    },
    tokenize_utterances: (utterances, lang, vocab) => state.languageProvider.tokenize(utterances, lang, vocab),
    vectorize_tokens: async (tokens, lang) => {
      const a = await state.languageProvider.vectorize(tokens, lang);
      return a.map(x => Array.from(x.values()));
    },
    generateSimilarJunkWords: (vocab, lang) => state.languageProvider.generateSimilarJunkWords(vocab, lang),
    mlToolkit: bp.MLToolkit,
    duckling: new _duckling_extractor.DucklingEntityExtractor(bp.logger),
    reportTrainingProgress: async (botId, message, trainSession) => {
      await (0, _trainSessionService.setTrainingSession)(bp, botId, trainSession);
      const ev = {
        type: 'nlu',
        working: trainSession.status === 'training',
        botId,
        message,
        trainSession: _lodash.default.omit(trainSession, 'lock')
      };
      bp.realtime.sendPayload(bp.RealTimePayload.forAdmins('statusbar.event', ev));

      if (trainSession.status === 'done') {
        setTimeout(() => (0, _trainSessionService.removeTrainingSession)(bp, botId, trainSession), 5000);
      }
    }
  };

  _engine.default.provideTools(tools);
}

async function initDucklingExtractor(bp) {
  const globalConfig = await bp.config.getModuleConfig('nlu');
  await _duckling_extractor.DucklingEntityExtractor.configure(globalConfig.ducklingEnabled, globalConfig.ducklingURL, bp.logger);
}

const EVENTS_TO_IGNORE = ['session_reference', 'session_reset', 'bp_dialog_timeout', 'visit', 'say_something', ''];

const registerMiddleware = async (bp, state) => {
  bp.events.registerMiddleware({
    name: 'nlu.incoming',
    direction: 'incoming',
    order: 10,
    description: 'Process natural language in the form of text. Structured data with an action and parameters for that action is injected in the incoming message event.',
    handler: async (event, next) => {
      if (!state.nluByBot[event.botId] || !state.health.isEnabled || !event.preview || EVENTS_TO_IGNORE.includes(event.type) || event.hasFlag(bp.IO.WellKnownFlags.SKIP_NATIVE_NLU)) {
        return next();
      }

      let nluResults = {};
      const {
        engine
      } = state.nluByBot[event.botId];

      const extractEngine2 = async () => {
        try {
          // eventually if model not loaded for bot languages ==> train or load
          nluResults = await engine.predict(event.preview, event.nlu.includedContexts);
        } catch (err) {
          if (err instanceof _predictPipeline.InvalidLanguagePredictorError) {
            const model = await (0, _modelService.getLatestModel)(bp.ghost.forBot(event.botId), err.languageCode);
            await engine.loadModel(model); // might throw again, thus usage of bluebird retry

            nluResults = await engine.predict(event.preview, event.nlu.includedContexts);
          }
        }
      };

      try {
        await (0, _bluebirdRetry.default)(extractEngine2, {
          max_tries: 2,
          throw_original: true
        });

        _lodash.default.merge(event, {
          nlu: nluResults
        });

        removeSensitiveText(event);
      } catch (err) {
        bp.logger.warn('Error extracting metadata for incoming text: ' + err.message);
      } finally {
        next();
      }
    }
  });

  function removeSensitiveText(event) {
    if (!event.nlu.entities || !event.payload.text) {
      return;
    }

    try {
      const sensitiveEntities = event.nlu.entities.filter(ent => ent.sensitive);

      for (const entity of sensitiveEntities) {
        const stars = '*'.repeat(entity.data.value.length);
        event.payload.text = event.payload.text.replace(entity.data.value, stars);
      }
    } catch (err) {
      bp.logger.warn('Error removing sensitive information: ' + err.message);
    }
  }
};

function getOnSeverStarted(state) {
  return async bp => {
    await initDucklingExtractor(bp);
    await initializeLanguageProvider(bp, state);
    initializeEngine(bp, state);
    await registerMiddleware(bp, state);
  };
}
//# sourceMappingURL=on-server-started.js.map