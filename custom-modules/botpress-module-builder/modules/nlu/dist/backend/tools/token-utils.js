"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.tokenizeLatinTextForTests = tokenizeLatinTextForTests;
exports.restoreOriginalUtteranceCasing = exports.processUtteranceTokens = exports.mergeSimilarCharsetTokens = exports.convertToRealSpaces = exports.isSpace = exports.hasSpace = exports.isWord = exports.SPACE = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

var _chars = require("./chars");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const SPACE = '\u2581';
exports.SPACE = SPACE;

const isWord = str => _lodash.default.every(_chars.SPECIAL_CHARSET, c => !RegExp(c).test(str)) && !hasSpace(str);

exports.isWord = isWord;

const hasSpace = str => _lodash.default.some(str, isSpace);

exports.hasSpace = hasSpace;

const isSpace = str => _lodash.default.every(str, c => c === SPACE || c === ' ');

exports.isSpace = isSpace;

const convertToRealSpaces = str => str.replace(new RegExp(SPACE, 'g'), ' ');

exports.convertToRealSpaces = convertToRealSpaces;

function splitSpaceToken(token) {
  return token.split(new RegExp(`(${SPACE})`, 'g')).filter(_lodash.default.identity);
}
/**
 * Basically mimics the language server tokenizer. Use this function for testing purposes
 * @param text text you want to tokenize
 */


function tokenizeLatinTextForTests(text) {
  return splitSpaceToken(text.replace(/\s/g, SPACE));
}

/**
 * Merges consecutive tokens that all respect the provided regex
 * @param tokens list of string representing a sentence
 * @param charPatterns (string patterns) that **every** characters in a token **can** match
 * @param matcher custom matcher function called on each token
 * @example ['13', 'lo', '34', '56'] with a char pool of numbers ==> ['13', 'lo', '3456']
 * @example ['_', '__', '_', 'abc'] with a char pool of ['_'] ==> ['____', 'abc']
 */
const mergeSimilarCharsetTokens = (tokens, charPatterns, matcher = () => true) => {
  const charMatcher = new RegExp(`^(${charPatterns.join('|')})+$`, 'i');
  return tokens.reduce((mergedToks, nextTok) => {
    const prev = _lodash.default.last(mergedToks);

    if (prev && charMatcher.test(prev) && charMatcher.test(nextTok) && (matcher(prev) || matcher(nextTok))) {
      return [...mergedToks.slice(0, mergedToks.length - 1), `${_lodash.default.last(mergedToks) || ''}${nextTok}`];
    } else {
      return [...mergedToks, nextTok];
    }
  }, []);
};

exports.mergeSimilarCharsetTokens = mergeSimilarCharsetTokens;

const mergeSpaces = tokens => mergeSimilarCharsetTokens(tokens, [SPACE]);

const mergeNumeral = tokens => mergeSimilarCharsetTokens(tokens, ['[0-9]']);

const mergeSpecialChars = tokens => mergeSimilarCharsetTokens(tokens, _chars.SPECIAL_CHARSET);

const mergeLatin = (tokens, vocab) => {
  const oovMatcher = token => {
    return token && !vocab[token.toLowerCase()];
  };

  return mergeSimilarCharsetTokens(tokens, _chars.LATIN_CHARSET, oovMatcher);
};

const processUtteranceTokens = (tokens, vocab = {}) => {
  return _lodash.default.chain(tokens).flatMap(splitSpaceToken).thru(mergeSpaces).thru(mergeNumeral).thru(mergeSpecialChars).thru(tokens => mergeLatin(tokens, vocab)).thru(tokens => tokens.length && tokens[0].startsWith(SPACE) ? tokens.slice(1) : tokens) // remove 1st token if space, even if input trimmed, sometimes tokenizer returns space char
  .value();
};

exports.processUtteranceTokens = processUtteranceTokens;

const restoreOriginalUtteranceCasing = (utteranceTokens, utterance) => {
  let offset = 0;
  return utteranceTokens.map(t => {
    const original = isSpace(t) ? t : utterance.substr(offset, t.length);
    offset += t.length;
    return original;
  });
};

exports.restoreOriginalUtteranceCasing = restoreOriginalUtteranceCasing;
//# sourceMappingURL=token-utils.js.map