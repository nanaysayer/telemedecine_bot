"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isPOSAvailable = isPOSAvailable;
exports.getPOSTagger = getPOSTagger;
exports.tagSentence = tagSentence;
exports.fallbackTagger = exports.POS_CLASSES = void 0;

var _path = _interopRequireDefault(require("path"));

var _tokenUtils = require("../tools/token-utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const POS_CLASSES = ['ADJ', 'ADP', 'ADV', 'AUX', 'CONJ', 'CCONJ', 'DET', 'INTJ', 'NOUN', 'NUM', 'PART', 'PRON', 'PROPN', 'PUNCT', 'SCONJ', 'SYM', 'VERB', 'X', _tokenUtils.SPACE];
exports.POS_CLASSES = POS_CLASSES;

function isPOSAvailable(lang) {
  // TODO check that language is part of supported languages once we support more
  return lang === 'en' || lang == 'fr';
}

function getPretrainedModelFilePath(languageCode) {
  return _path.default.join(__dirname, `./pre-trained/pos.${languageCode}.model`);
}

function n_alpha(word) {
  // TODO support more alphabets
  return (word.match(/[a-zA-z]/g) || []).length;
}

function n_digits(word) {
  return (word.match(/\d/g) || []).length;
}

function pref(word, nchars) {
  return word.length > nchars ? word.slice(0, nchars) : '';
}

function suff(word, nchars) {
  return word.length > nchars ? word.slice(-nchars) : '';
}

function wordFeatures(seq, idx) {
  const word = seq[idx].toLowerCase();
  const a = n_alpha(word);
  const d = n_digits(word);
  const bos = idx === 0;
  const eos = idx == seq.length - 1;
  const feats = {
    BOS: bos,
    EOS: eos,
    prefix_1: pref(word, 1),
    prefix_2: pref(word, 2),
    prefix_3: pref(word, 3),
    prefix_4: pref(word, 4),
    suffix_1: suff(word, 1),
    suffix_2: suff(word, 2),
    suffix_3: suff(word, 3),
    suffix_4: suff(word, 4),
    len: word.length,
    alpha: a,
    contains_num: d > 0,
    contains_special: word.length - a - d > 0,
    word: word,
    prev_word: bos ? '' : seq[idx - 1].toLowerCase(),
    next_word: eos ? '' : seq[idx + 1].toLowerCase()
  };
  return Object.entries(feats).filter(([key, val]) => val).map(([key, val]) => {
    const v = typeof val === 'boolean' ? '' : `=${val}`;
    return `${key}${v}`;
  });
}

const fallbackTagger = {
  tag: seq => ({
    probability: 1,
    result: new Array(seq.length).fill('N/A')
  }),
  open: f => false,
  marginal: seq => new Array(seq.length).fill({
    'N/A': 1
  })
}; // eventually this will be moved in language provider
// POS tagging will reside language server once we support more than english

exports.fallbackTagger = fallbackTagger;
const taggersByLang = {};

function getPOSTagger(languageCode, toolkit) {
  if (!isPOSAvailable(languageCode)) {
    return fallbackTagger;
  }

  if (!taggersByLang[languageCode]) {
    const tagger = toolkit.CRF.createTagger();
    tagger.open(getPretrainedModelFilePath(languageCode));
    taggersByLang[languageCode] = tagger;
  }

  return taggersByLang[languageCode];
}

function tagSentence(tagger, tokens) {
  const [words, spaceIdx] = tokens.reduce(([words, spaceIdx], token, idx) => {
    if ((0, _tokenUtils.isSpace)(token)) {
      return [words, [...spaceIdx, idx]];
    } else {
      return [[...words, token], spaceIdx];
    }
  }, [[], []]);
  const feats = [];

  for (let i = 0; i < words.length; i++) {
    feats.push(wordFeatures(words, i));
  }

  const tags = tagger.tag(feats).result;

  for (const idx of spaceIdx) {
    tags.splice(idx, 0, _tokenUtils.SPACE);
  }

  return tags;
}
//# sourceMappingURL=pos-tagger.js.map