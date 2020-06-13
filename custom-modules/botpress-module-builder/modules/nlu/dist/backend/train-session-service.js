"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getTrainingSession = getTrainingSession;
exports.setTrainingSession = setTrainingSession;
exports.removeTrainingSession = removeTrainingSession;
exports.makeTrainingSession = exports.makeTrainSessionKey = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const DEFAULT_TRAINING_SESSION = {
  status: 'idle',
  progress: 0
};

const makeTrainSessionKey = (botId, language) => `training:${botId}:${language}`;

exports.makeTrainSessionKey = makeTrainSessionKey;

const makeTrainingSession = (language, lock) => ({
  status: 'training',
  progress: 0,
  language,
  lock
});

exports.makeTrainingSession = makeTrainingSession;

async function getTrainingSession(bp, botId, language) {
  const key = makeTrainSessionKey(botId, language);
  const trainSession = await bp.kvs.forBot(botId).get(key);
  return trainSession || { ...DEFAULT_TRAINING_SESSION,
    language
  };
}

function setTrainingSession(bp, botId, trainSession) {
  const key = makeTrainSessionKey(botId, trainSession.language);
  return bp.kvs.forBot(botId).set(key, _lodash.default.omit(trainSession, 'lock'));
}

async function removeTrainingSession(bp, botId, trainSession) {
  await bp.kvs.forBot(botId).removeStorageKeysStartingWith(makeTrainSessionKey(botId, trainSession.language));
}
//# sourceMappingURL=train-session-service.js.map