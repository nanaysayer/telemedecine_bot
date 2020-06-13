"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const defaultCompare = (a, b) => a === b; // TODO add loads of test cases for this if this is to stay in the product


class MultiClassF1Scorer {
  constructor(compare = defaultCompare) {
    this.compare = compare;

    _defineProperty(this, "recordsMap", void 0);

    this.recordsMap = {};
  }

  record(actual, expected) {
    if (this.compare(actual, expected)) {
      const tp = _lodash.default.get(this.recordsMap, `${actual}.tp`, 0);

      _lodash.default.set(this.recordsMap, `${actual}.tp`, tp + 1)[actual].tp = tp + 1;
    } else {
      const fn = _lodash.default.get(this.recordsMap, `${expected}.fn`, 0);

      const fp = _lodash.default.get(this.recordsMap, `${actual}.fp`, 0);

      _lodash.default.set(this.recordsMap, `${expected}.fn`, fn + 1);

      _lodash.default.set(this.recordsMap, `${actual}.fp`, fp + 1);
    }
  }

  getClassResults(cls) {
    const {
      tp,
      fp,
      fn
    } = {
      tp: 0,
      fp: 0,
      fn: 0,
      ...this.recordsMap[cls]
    };
    const precision = tp === 0 ? 0 : tp / (tp + fp);
    const recall = tp === 0 ? 0 : tp / (tp + fn);
    const f1 = precision === 0 || recall === 0 ? 0 : 2 * precision * recall / (precision + recall);
    return {
      precision,
      recall,
      f1
    };
  } // We use macro-F1 at the moment, offer options for micro-F1 and weighted-F1


  getResults() {
    const clsF1 = Object.keys(this.recordsMap).map(this.getClassResults.bind(this));
    return {
      precision: _lodash.default.round(_lodash.default.meanBy(clsF1, 'precision'), 2),
      recall: _lodash.default.round(_lodash.default.meanBy(clsF1, 'recall'), 2),
      f1: _lodash.default.round(_lodash.default.meanBy(clsF1, 'f1'), 2)
    };
  }

}

exports.default = MultiClassF1Scorer;
//# sourceMappingURL=f1-scorer.js.map