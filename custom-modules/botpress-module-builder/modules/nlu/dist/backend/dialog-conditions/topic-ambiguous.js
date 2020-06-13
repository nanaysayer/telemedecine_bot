"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = {
  id: 'topic_is_ambiguous',
  label: 'Detected topics are ambiguous',
  description: 'What user said might refer to multiple topics ',
  displayOrder: 2,
  params: {
    ambiguityThreshold: {
      label: 'Ambiguity threshold',
      type: 'number',
      defaultValue: 0.15
    }
  },
  evaluate: (event, {
    ambiguityThreshold
  }) => {
    var _ref, _event$nlu;

    const highestTopics = _lodash.default.chain((_ref = event === null || event === void 0 ? void 0 : (_event$nlu = event.nlu) === null || _event$nlu === void 0 ? void 0 : _event$nlu.predictions) !== null && _ref !== void 0 ? _ref : {}).toPairs().filter(x => x[0] !== 'oos').orderBy('1.confidence', 'desc').map('1.confidence').take(2).value();

    if (highestTopics.length <= 1) {
      // no confusion with a single or no topic)
      return 0;
    }

    const gap = highestTopics[0] - highestTopics[1];

    if (gap > ambiguityThreshold) {
      return 0;
    }

    return 1 - gap / ambiguityThreshold;
  }
};
exports.default = _default;
//# sourceMappingURL=topic-ambiguous.js.map