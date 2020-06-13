"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getOnBotMount = getOnBotMount;

var _lodash = _interopRequireDefault(require("lodash"));

var _ms = _interopRequireDefault(require("ms"));

var _yn = _interopRequireDefault(require("yn"));

var _autoTrain = require("../autoTrain");

var _engine = _interopRequireDefault(require("../engine"));

var _entitiesService = _interopRequireDefault(require("../entities/entities-service"));

var _intentService = require("../intents/intent-service");

var ModelService = _interopRequireWildcard(require("../model-service"));

var _trainSessionService = require("../train-session-service");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const missingLangMsg = botId => `Bot ${botId} has configured languages that are not supported by language sources. Configure a before incoming hook to call an external NLU provider for those languages.`;

const KVS_TRAINING_STATUS_KEY = 'nlu:trainingStatus';

function getOnBotMount(state) {
  return async (bp, botId) => {
    const bot = await bp.bots.getBotById(botId);
    const ghost = bp.ghost.forBot(botId);
    const entityService = new _entitiesService.default(ghost, botId);
    const languages = ['uk'];

    if (bot.languages.length !== languages.length) {
      bp.logger.warn(missingLangMsg(botId), {
        notSupported: _lodash.default.difference(bot.languages, languages)
      });
    }

    const engine = new _engine.default(bot.defaultLanguage, bot.id);

    const trainOrLoad = _lodash.default.debounce(async (forceTrain = false) => {
      // bot got deleted
      if (!state.nluByBot[botId]) {
        return;
      }

      const intentDefs = await (0, _intentService.getIntents)(ghost);
      const entityDefs = await entityService.getCustomEntities();
      const hash = ModelService.computeModelHash(intentDefs, entityDefs);
      const kvs = bp.kvs.forBot(botId);
      await kvs.set(KVS_TRAINING_STATUS_KEY, 'training');

      try {
        await Promise.mapSeries(languages, async languageCode => {
          // shorter lock and extend in training steps
          const lock = await bp.distributed.acquireLock((0, _trainSessionService.makeTrainSessionKey)(botId, languageCode), (0, _ms.default)('5m'));

          if (!lock) {
            return;
          }

          await ModelService.pruneModels(ghost, languageCode);
          let model = await ModelService.getModel(ghost, hash, languageCode);

          if ((forceTrain || !model) && !(0, _yn.default)(process.env.BP_NLU_DISABLE_TRAINING)) {
            const trainSession = (0, _trainSessionService.makeTrainingSession)(languageCode, lock);
            state.nluByBot[botId].trainSessions[languageCode] = trainSession;
            model = await engine.train(intentDefs, entityDefs, languageCode, trainSession);

            if (model.success) {
              await engine.loadModel(model);
              await ModelService.saveModel(ghost, model, hash);
            }
          }

          try {
            var _model;

            if ((_model = model) === null || _model === void 0 ? void 0 : _model.success) {
              await state.broadcastLoadModel(botId, hash, languageCode);
            }
          } finally {
            await lock.unlock();
          }
        });
      } finally {
        await kvs.delete(KVS_TRAINING_STATUS_KEY);
      }
    }, 10000, {
      leading: true
    }); // register trainOrLoad with ghost file watcher
    // we use local events so training occurs on the same node where the request for changes enters


    const trainWatcher = bp.ghost.forBot(botId).onFileChanged(async f => {
      if (f.includes('intents') || f.includes('entities')) {
        if (await (0, _autoTrain.isOn)(bp, botId)) {
          // eventually cancel & restart training only for given language
          await cancelTraining();
          trainOrLoad();
        }
      }
    });

    const cancelTraining = async () => {
      await Promise.map(languages, async lang => {
        const key = (0, _trainSessionService.makeTrainSessionKey)(botId, lang);
        await bp.distributed.clearLock(key);
        return state.broadcastCancelTraining(botId, lang);
      });
    };

    const isTraining = async () => {
      return bp.kvs.forBot(botId).exists(KVS_TRAINING_STATUS_KEY);
    };

    state.nluByBot[botId] = {
      botId,
      engine,
      trainWatcher,
      trainOrLoad,
      trainSessions: {},
      cancelTraining,
      isTraining,
      entityService
    };
    trainOrLoad((0, _yn.default)(process.env.FORCE_TRAIN_ON_MOUNT)); // floating promise on purpose
  };
}
//# sourceMappingURL=on-bot-mount.js.map
