"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = {
  id: 'intent_is_ambiguous',
  label: 'Intent is ambiguous within topic',
  description: `The users's intention is can be interpreted as multiple intents within the same topic`,
  displayOrder: 1,
  params: {
    ambiguityThreshold: {
      label: 'Ambiguity threshold',
      type: 'number',
      defaultValue: 0.1
    },
    onlyIfActive: {
      label: 'Only if topic is already active',
      type: 'boolean',
      defaultValue: false
    }
  },
  evaluate: (event, {
    ambiguityThreshold,
    onlyIfActive,
    topicName
  }) => {
    var _ref, _event$nlu;

    const currentTopic = _lodash.default.get(event.state.session, 'nduContext.last_topic');

    if (onlyIfActive && currentTopic !== topicName) {
      return 0;
    }

    const [highestTopic, topicPreds] = _lodash.default.chain((_ref = event === null || event === void 0 ? void 0 : (_event$nlu = event.nlu) === null || _event$nlu === void 0 ? void 0 : _event$nlu.predictions) !== null && _ref !== void 0 ? _ref : {}).toPairs().orderBy(x => x[1].confidence, 'desc').filter(x => x[0] !== 'oos').first().value() || [];

    if (!topicName || !highestTopic || topicName !== highestTopic) {
      // consider intent confusion only when predicted topic is same as current topic
      return 0;
    }

    const higestIntents = _lodash.default.chain(topicPreds.intents).filter(i => i.label !== 'none').orderBy('confidence', 'desc').map('confidence').take(2).value();

    if (higestIntents.length <= 1) {
      // no confusion with a single or no intent(s)
      return 0;
    }

    const gap = higestIntents[0] - higestIntents[1];

    if (gap > ambiguityThreshold) {
      return 0;
    }

    return 1 - gap / ambiguityThreshold;
  }
};
exports.default = _default;
//# sourceMappingURL=intent-ambiguous.js.map