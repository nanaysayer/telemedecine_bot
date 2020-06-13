"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getOnBotUnmount = getOnBotUnmount;

var _lodash = _interopRequireDefault(require("lodash"));

var _trainSessionService = require("../train-session-service");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getOnBotUnmount(state) {
  return async (bp, botId) => {
    if (!state.nluByBot[botId]) {
      return;
    }

    const activeTrainSession = _lodash.default.chain(_lodash.default.get(state.nluByBot[botId], 'trainSessions', {})).values().filter(trainSession => trainSession.status === 'training').value();

    await Promise.map(activeTrainSession, async ts => {
      await state.broadcastCancelTraining(botId, ts.language);
      await (0, _trainSessionService.removeTrainingSession)(bp, botId, ts);
    });
    state.nluByBot[botId].trainWatcher.remove();
    delete state.nluByBot[botId];
  };
}
//# sourceMappingURL=on-bot-unmount.js.map