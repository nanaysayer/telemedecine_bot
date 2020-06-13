"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getSentenceEmbeddingForCtx = getSentenceEmbeddingForCtx;

var _lodash = _interopRequireDefault(require("lodash"));

var _math = require("../tools/math");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function shouldConsiterToken(token) {
  const isSysOrPatternEntity = token.entities.some(en => en.metadata.extractor === 'pattern' || en.metadata.extractor === 'system');
  return token.isWord && !isSysOrPatternEntity;
}

function getSentenceEmbeddingForCtx(utt) {
  const toks = utt.tokens.filter(shouldConsiterToken);

  if (_lodash.default.isEmpty(toks)) {
    return (0, _math.zeroes)(utt.tokens[0].vector.length);
  }

  const totalWeight = toks.reduce((sum, t) => sum + Math.min(1, t.tfidf), 0) || 1;
  const weightedSum = toks.reduce((sum, t) => {
    const norm = (0, _math.computeNorm)(t.vector);
    const weightedVec = (0, _math.scalarDivide)(t.vector, norm / Math.min(1, t.tfidf));
    return (0, _math.vectorAdd)(sum, weightedVec);
  }, (0, _math.zeroes)(utt.tokens[0].vector.length));
  return (0, _math.scalarDivide)(weightedSum, totalWeight);
}
//# sourceMappingURL=context-classifier-featurizer.js.map