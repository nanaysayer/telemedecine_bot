"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isOn = exports.set = void 0;
const KVS_KEY = 'nlu-autoTrain';

const set = async (bp, botId, autoTrain) => {
  const kvs = bp.kvs.forBot(botId);

  if (autoTrain) {
    await kvs.delete(KVS_KEY);
  } else {
    await kvs.set(KVS_KEY, 'pause');
  }
};

exports.set = set;

const isOn = async (bp, botId) => {
  return !(await bp.kvs.forBot(botId).exists(KVS_KEY));
};

exports.isOn = isOn;
//# sourceMappingURL=autoTrain.js.map