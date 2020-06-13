"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = tfidf;
exports.MIN_TFIDF = exports.MAX_TFIDF = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const MAX_TFIDF = 2;
exports.MAX_TFIDF = MAX_TFIDF;
const MIN_TFIDF = 0.5;
exports.MIN_TFIDF = MIN_TFIDF;

function tfidf(docs) {
  const result = {};
  const _avgSum = {};
  const _avgCount = {};

  for (const docName in docs) {
    const tokens = docs[docName];

    const termsCount = _lodash.default.countBy(tokens, _lodash.default.identity);

    const meanTf = _lodash.default.mean(_lodash.default.values(termsCount));

    const tfidf = _lodash.default.mapValues(termsCount, (_v, key) => {
      const docFreq = _lodash.default.values(docs).filter(x => x.includes(key)).length; // Double-normalization TF with K=0.5
      // See https://en.wikipedia.org/wiki/Tf%E2%80%93idf


      const tf = 0.5 + 0.5 * termsCount[key] / meanTf; // Smooth IDF

      const idf = Math.max(0.25, -Math.log(docFreq / Object.keys(docs).length));
      const tfidf = Math.max(MIN_TFIDF, Math.min(MAX_TFIDF, tf * idf));
      _avgSum[key] = (_avgSum[key] || 0) + tfidf;
      _avgCount[key] = (_avgCount[key] || 0) + 1;
      return tfidf;
    });

    tfidf['__avg__'] = _lodash.default.mean(_lodash.default.values(tfidf));
    result[docName] = tfidf;
  }

  result['__avg__'] = _lodash.default.mapValues(_avgSum, (v, key) => v / _avgCount[key]);
  return result;
}
//# sourceMappingURL=tfidf.js.map