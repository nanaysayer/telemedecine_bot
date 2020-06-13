"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.featToCRFsuiteAttr = featToCRFsuiteAttr;
exports.getFeatPairs = getFeatPairs;
exports.getWordWeight = getWordWeight;
exports.getClusterFeat = getClusterFeat;
exports.getWordFeat = getWordFeat;
exports.getInVocabFeat = getInVocabFeat;
exports.getEntitiesFeats = getEntitiesFeats;
exports.getSpaceFeat = getSpaceFeat;
exports.getNum = getNum;
exports.getAlpha = getAlpha;
exports.getSpecialChars = getSpecialChars;
exports.getIntentFeature = getIntentFeature;
exports.getTokenQuartile = getTokenQuartile;
exports.getPOSFeat = getPOSFeat;

var _lodash = _interopRequireDefault(require("lodash"));

var _sanitizer = require("../language/sanitizer");

var _math = require("../tools/math");

var _strings = require("../tools/strings");

var _tfidf = require("../tools/tfidf");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const TFIDF_WEIGHTS = ['low', 'medium', 'high'];

function featToCRFsuiteAttr(prefix, feat) {
  return `${prefix}${feat.name}=${feat.value}:${feat.boost || 1}`;
}

function getFeatPairs(feats0, feats1, featNames) {
  const valueOf = feat => _lodash.default.get(feat, 'value', 'null');

  const boostOf = feat => _lodash.default.get(feat, 'boost', 1);

  return featNames.map(targetFeat => {
    const f0 = feats0.find(f => f.name === targetFeat);
    const f1 = feats1.find(f => f.name === targetFeat);

    if (f0 || f1) {
      return {
        name: targetFeat,
        value: `${valueOf(f0)}|${valueOf(f1)}`,
        boost: Math.max(boostOf(f0), boostOf(f1))
      };
    }
  }).filter(_lodash.default.identity);
}

function getWordWeight(token) {
  const tierce = (0, _math.computeQuantile)(3, token.tfidf, _tfidf.MAX_TFIDF, _tfidf.MIN_TFIDF);
  const value = TFIDF_WEIGHTS[tierce - 1];
  return {
    name: 'weight',
    value
  };
}

function getClusterFeat(token) {
  return {
    name: 'cluster',
    value: token.cluster
  };
}

function getWordFeat(token, isPredict) {
  const boost = isPredict ? 3 : 1;

  if (_lodash.default.isEmpty(token.entities) && token.isWord) {
    return {
      name: 'word',
      value: token.toString({
        lowerCase: true
      }),
      boost
    };
  }
}

function getInVocabFeat(token, intent) {
  const inVocab = !!intent.vocab[token.toString({
    lowerCase: true
  })];
  return {
    name: 'inVocab',
    value: inVocab
  };
}

function getEntitiesFeats(token, allowedEntities, isPredict) {
  const boost = isPredict ? 3 : 1;
  return _lodash.default.chain(token.entities).map(e => e.type).intersectionWith(allowedEntities).thru(ents => ents.length ? ents : ['none']).map(entity => ({
    name: 'entity',
    value: entity,
    boost
  })).value();
}

function getSpaceFeat(token) {
  return {
    name: 'space',
    value: token && token.isSpace
  };
}

function getNum(token) {
  return {
    name: 'num',
    value: (0, _strings.countNum)(token.value)
  };
}

function getAlpha(token) {
  return {
    name: 'alpha',
    value: (0, _strings.countAlpha)(token.value)
  };
}

function getSpecialChars(token) {
  return {
    name: 'special',
    value: (0, _strings.countSpecial)(token.value)
  };
}

function getIntentFeature(intent) {
  return {
    name: 'intent',
    value: (0, _sanitizer.sanitize)(intent.name.replace(/\s/g, '')),
    boost: 100
  };
}

function getTokenQuartile(utterance, token) {
  return {
    name: 'quartile',
    value: (0, _math.computeQuantile)(4, token.index + 1, utterance.tokens.length)
  };
}

function getPOSFeat(token) {
  return {
    name: 'POS',
    value: token.POS
  };
}
//# sourceMappingURL=slot-featurizer.js.map