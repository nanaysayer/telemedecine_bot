"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.buildUtteranceBatch = buildUtteranceBatch;
exports.getAlternateUtterance = getAlternateUtterance;
exports.makeTestUtterance = makeTestUtterance;
exports.default = exports.DefaultTokenToStringOptions = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

var _chars = require("../tools/chars");

var _math = require("../tools/math");

var _strings = require("../tools/strings");

var _tokenUtils = require("../tools/token-utils");

var _vocab = require("../tools/vocab");

var _utteranceParser = require("./utterance-parser");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const DefaultTokenToStringOptions = {
  lowerCase: false,
  realSpaces: true,
  trim: false
};
exports.DefaultTokenToStringOptions = DefaultTokenToStringOptions;

class Utterance {
  constructor(tokens, vectors, posTags, languageCode) {
    this.languageCode = languageCode;

    _defineProperty(this, "slots", []);

    _defineProperty(this, "entities", []);

    _defineProperty(this, "_tokens", []);

    _defineProperty(this, "_globalTfidf", void 0);

    _defineProperty(this, "_kmeans", void 0);

    _defineProperty(this, "_sentenceEmbedding", void 0);

    const allSameLength = [tokens, vectors, posTags].every(arr => arr.length === tokens.length);

    if (!allSameLength) {
      throw Error(`Tokens, vectors and postTags dimensions must match`);
    }

    const arr = [];

    for (let i = 0, offset = 0; i < tokens.length; i++) {
      const that = this;
      const value = tokens[i];
      arr.push(Object.freeze({
        index: i,
        isBOS: i === 0,
        isEOS: i === tokens.length - 1,
        isWord: (0, _tokenUtils.isWord)(value),
        offset: offset,
        isSpace: (0, _tokenUtils.isSpace)(value),

        get slots() {
          return that.slots.filter(x => x.startTokenIdx <= i && x.endTokenIdx >= i);
        },

        get entities() {
          return that.entities.filter(x => x.startTokenIdx <= i && x.endTokenIdx >= i);
        },

        get tfidf() {
          return that._globalTfidf && that._globalTfidf[value] || 1;
        },

        get cluster() {
          const wordVec = vectors[i];
          return that._kmeans && that._kmeans.nearest([wordVec])[0] || 1;
        },

        value: value,
        vector: vectors[i],
        POS: posTags[i],
        toString: (opts = {}) => {
          const options = { ...DefaultTokenToStringOptions,
            ...opts
          };
          let result = value;

          if (options.lowerCase) {
            result = result.toLowerCase();
          }

          if (options.realSpaces) {
            result = (0, _tokenUtils.convertToRealSpaces)(result);
          }

          if (options.trim) {
            result = result.trim();
          }

          return result;
        }
      }));
      offset += value.length;
    }

    this._tokens = arr;
  }

  get tokens() {
    return this._tokens;
  }

  get sentenceEmbedding() {
    if (this._sentenceEmbedding) {
      return this._sentenceEmbedding;
    }

    let totalWeight = 0;
    const dims = this._tokens[0].vector.length;
    let sentenceEmbedding = new Array(dims).fill(0);

    for (const token of this.tokens) {
      const norm = (0, _math.computeNorm)(token.vector);

      if (norm <= 0 || !token.isWord) {
        // ignore special char tokens in sentence embeddings
        continue;
      } // hard limit on TFIDF of (we don't want to over scale the features)


      const weight = Math.min(1, token.tfidf);
      totalWeight += weight;
      const weightedVec = (0, _math.scalarDivide)(token.vector, norm / weight);
      sentenceEmbedding = (0, _math.vectorAdd)(sentenceEmbedding, weightedVec);
    }

    this._sentenceEmbedding = (0, _math.scalarDivide)(sentenceEmbedding, totalWeight);
    return this._sentenceEmbedding;
  }

  setGlobalTfidf(tfidf) {
    this._globalTfidf = tfidf;
  }

  setKmeans(kmeans) {
    this._kmeans = kmeans;
  } // TODO memoize this for better perf


  toString(options) {
    options = _lodash.default.defaultsDeep({}, options, {
      lowerCase: false,
      slots: 'keep-value'
    });
    let final = '';
    let ret = [...this.tokens];

    if (options.onlyWords) {
      ret = ret.filter(tok => tok.slots.length || tok.isWord);
    }

    for (const tok of ret) {
      let toAdd = '';

      if (!tok.slots.length && !tok.entities.length) {
        toAdd = tok.value;
      } // case ignore is handled implicitly


      if (tok.slots.length && options.slots === 'keep-name') {
        toAdd = tok.slots[0].name;
      } else if (tok.slots.length && options.slots === 'keep-value') {
        toAdd = tok.value;
      } else if (tok.entities.length && options.entities === 'keep-name') {
        toAdd = tok.entities[0].type;
      } else if (tok.entities.length && options.entities === 'keep-value') {
        toAdd = tok.entities[0].value.toString();
      } else if (tok.entities.length && options.entities === 'keep-default') {
        toAdd = tok.value;
      }

      final += toAdd;
    }

    if (options.lowerCase) {
      final = final.toLowerCase();
    }

    return final.replace(new RegExp(_tokenUtils.SPACE, 'g'), ' ');
  }

  clone(copyEntities, copySlots) {
    const tokens = this.tokens.map(x => x.value);
    const vectors = this.tokens.map(x => x.vector);
    const POStags = this.tokens.map(x => x.POS);
    const utterance = new Utterance(tokens, vectors, POStags, this.languageCode);
    utterance.setGlobalTfidf({ ...this._globalTfidf
    });

    if (copyEntities) {
      this.entities.forEach(entity => utterance.tagEntity(entity, entity.startPos, entity.endPos));
    }

    if (copySlots) {
      this.slots.forEach(slot => utterance.tagSlot(slot, slot.startPos, slot.endPos));
    }

    return utterance;
  }

  _validateRange(start, end) {
    const lastTok = _lodash.default.last(this._tokens);

    const maxEnd = _lodash.default.get(lastTok, 'offset', 0) + _lodash.default.get(lastTok, 'value.length', 0);

    if (start < 0 || start > end || start > maxEnd || end > maxEnd) {
      throw new Error('Invalid range');
    }
  }

  tagEntity(entity, start, end) {
    this._validateRange(start, end);

    const range = this.tokens.filter(x => x.offset >= start && x.offset + x.value.length <= end);

    if (_lodash.default.isEmpty(range)) {
      return;
    }

    const entityWithPos = { ...entity,
      startPos: start,
      endPos: end,
      startTokenIdx: _lodash.default.first(range).index,
      endTokenIdx: _lodash.default.last(range).index
    };
    this.entities = [...this.entities, entityWithPos];
  }

  tagSlot(slot, start, end) {
    this._validateRange(start, end);

    const range = this.tokens.filter(x => x.offset >= start && x.offset + x.value.length <= end);

    if (_lodash.default.isEmpty(range)) {
      return;
    }

    const taggedSlot = { ...slot,
      startPos: start,
      endPos: end,
      startTokenIdx: _lodash.default.first(range).index,
      endTokenIdx: _lodash.default.last(range).index
    };
    this.slots = [...this.slots, taggedSlot];
  }

}

exports.default = Utterance;

async function buildUtteranceBatch(raw_utterances, language, tools, vocab) {
  const parsed = raw_utterances.map(u => (0, _utteranceParser.parseUtterance)((0, _strings.replaceConsecutiveSpaces)(u)));
  const tokenUtterances = await tools.tokenize_utterances(parsed.map(p => p.utterance), language, vocab);
  const POSUtterances = tools.partOfSpeechUtterances(tokenUtterances, language);

  const uniqTokens = _lodash.default.uniq(_lodash.default.flatten(tokenUtterances));

  const vectors = await tools.vectorize_tokens(uniqTokens, language);

  const vectorMap = _lodash.default.zipObject(uniqTokens, vectors);

  return _lodash.default.zip(tokenUtterances, POSUtterances, parsed).map(([tokUtt, POSUtt, {
    utterance: utt,
    parsedSlots
  }]) => {
    if (tokUtt.length === 0) {
      return;
    }

    const vectors = tokUtt.map(t => vectorMap[t]);
    const utterance = new Utterance(tokUtt, vectors, POSUtt, language); // TODO: temporary work-around
    // covers a corner case where tokenization returns tokens that are not identical to `parsed` utterance
    // the corner case is when there's a trailing space inside a slot at the end of the utterance, e.g. `my name is [Sylvain ](any)`

    if (utterance.toString().length === utt.length) {
      parsedSlots.forEach(s => {
        utterance.tagSlot({
          name: s.name,
          source: s.value,
          value: s.value,
          confidence: 1
        }, s.cleanPosition.start, s.cleanPosition.end);
      });
    } // else we skip the slot


    return utterance;
  }).filter(Boolean);
}

function uttTok2altTok(token) {
  return { ..._lodash.default.pick(token, ['vector', 'POS']),
    value: token.toString(),
    isAlter: false
  };
}

function isClosestTokenValid(originalToken, closestToken) {
  return (0, _tokenUtils.isWord)(closestToken) && originalToken.value.length > 3 && closestToken.length > 3;
}
/**
 * @description Returns slightly different version of the given utterance, replacing OOV tokens with their closest IV syntaxical neighbour
 * @param utterance the original utterance
 * @param vocabVectors Bot wide vocabulary
 */


function getAlternateUtterance(utterance, vocabVectors) {
  return _lodash.default.chain(utterance.tokens).map(token => {
    const strTok = token.toString({
      lowerCase: true
    });

    if (!token.isWord || vocabVectors[strTok] || !_lodash.default.isEmpty(token.entities)) {
      return uttTok2altTok(token);
    }

    const closestToken = (0, _vocab.getClosestToken)(strTok, token.vector, vocabVectors, false);

    if (isClosestTokenValid(token, closestToken)) {
      return {
        value: closestToken,
        vector: vocabVectors[closestToken],
        POS: token.POS,
        isAlter: true
      };
    } else {
      return uttTok2altTok(token);
    }
  }).thru(altToks => {
    const hasAlternate = altToks.length === utterance.tokens.length && altToks.some(t => t.isAlter);

    if (hasAlternate) {
      return new Utterance(altToks.map(t => t.value), altToks.map(t => t.vector), altToks.map(t => t.POS), utterance.languageCode);
    }
  }).value();
}
/**
 * @description Utility function that returns an utterance using a space tokenizer
 * @param str sentence as a textual value
 */


function makeTestUtterance(str) {
  const toks = str.split(new RegExp(`(${_chars.SPECIAL_CHARSET.join('|')}|\\s)`, 'gi'));
  const vecs = new Array(toks.length).fill([0]);
  const pos = new Array(toks.length).fill('N/A');
  return new Utterance(toks, vecs, pos, 'en');
}
//# sourceMappingURL=utterance.js.map