"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = {
  id: 'user_intent_is',
  label: 'User asks something (intent)',
  description: `The user's intention is {intentName}`,
  callback: '/mod/nlu/condition/intentChanged',
  displayOrder: 0,
  params: {
    intentName: {
      label: 'Name of intent',
      type: 'string'
    }
  },
  editor: {
    module: 'nlu',
    component: 'LiteEditor'
  },
  evaluate: (event, {
    intentName,
    topicName
  }) => {
    const oosConfidence = _lodash.default.get(event, `nlu.predictions.oos.confidence`, 0);

    const topicConf = _lodash.default.get(event, `nlu.predictions.${topicName}.confidence`, 0);

    const topicIntents = _lodash.default.get(event, `nlu.predictions.${topicName}.intents`, []);

    const intentConf = _lodash.default.get(topicIntents.find(x => x.label === intentName), 'confidence', 0);

    return topicConf * intentConf * (1 - oosConfidence);
  }
};
exports.default = _default;
//# sourceMappingURL=intent-is.js.map