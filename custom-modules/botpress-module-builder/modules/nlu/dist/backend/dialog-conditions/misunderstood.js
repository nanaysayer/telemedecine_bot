"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = {
  id: 'user_intent_misunderstood',
  label: 'Users says something misunderstood (intent)',
  description: `The user's intention is misunderstood`,
  displayOrder: 3,
  params: {
    maxConfidence: {
      label: 'Maximum reachable confidence (%)',
      type: 'number',
      defaultValue: 100,
      required: true
    }
  },
  evaluate: (event, params) => {
    var _ref, _event$nlu;

    const oos = _lodash.default.get(event, `nlu.predictions.oos.confidence`, 0);

    const highestCtx = _lodash.default.chain((_ref = event === null || event === void 0 ? void 0 : (_event$nlu = event.nlu) === null || _event$nlu === void 0 ? void 0 : _event$nlu.predictions) !== null && _ref !== void 0 ? _ref : {}).toPairs().orderBy(x => x[1].confidence, 'desc').map(x => x[0]).filter(x => x !== 'oos').first().value();

    const highest_none = _lodash.default.chain(event).get(`nlu.predictions.${highestCtx}.intents`, []).find(x => x.label === 'none').get('confidence', 0).value();

    const max = Math.max(highest_none, oos);
    return params.maxConfidence ? max * (params.maxConfidence / 100) : max;
  }
};
exports.default = _default;
//# sourceMappingURL=misunderstood.js.map