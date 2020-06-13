"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getOnServerReady = getOnServerReady;

var _lodash = _interopRequireDefault(require("lodash"));

var _api = _interopRequireDefault(require("../api"));

var _modelService = require("../model-service");

var _trainSessionService = require("../train-session-service");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getOnServerReady(state) {
  return async bp => {
    const loadModel = async (botId, hash, language) => {
      if (!state.nluByBot[botId]) {
        return;
      }

      const ghost = bp.ghost.forBot(botId);
      const model = await (0, _modelService.getModel)(ghost, hash, language);

      if (model) {
        if (state.nluByBot[botId]) {
          await state.nluByBot[botId].engine.loadModel(model);
        } else {
          bp.logger.warn(`Can't load model for unmounted bot ${botId}`);
        }
      }
    };

    const cancelTraining = async (botId, language) => {
      const trainSession = _lodash.default.get(state, `nluByBot.${botId}.trainSessions.${language}`);

      if (trainSession && trainSession.status === 'training') {
        if (trainSession.lock) {
          trainSession.lock.unlock();
        }

        trainSession.status = 'canceled';
        await (0, _trainSessionService.setTrainingSession)(bp, botId, trainSession);
      }
    }; // @ts-ignore


    state.broadcastLoadModel = await bp.distributed.broadcast(loadModel); // @ts-ignore

    state.broadcastCancelTraining = await bp.distributed.broadcast(cancelTraining);
    await (0, _api.default)(bp, state);
  };
}
//# sourceMappingURL=on-server-ready.js.map