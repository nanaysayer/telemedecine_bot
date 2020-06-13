"use strict";

var _chars = require("./chars");

var _tokenUtils = require("./token-utils");

test('isWord', () => {
  expect((0, _tokenUtils.isWord)('lol123')).toBeTruthy();
  expect((0, _tokenUtils.isWord)('hey 123')).toBeFalsy();
  expect((0, _tokenUtils.isWord)('!')).toBeFalsy();
  expect((0, _tokenUtils.isWord)('^jo!')).toBeFalsy();
  expect((0, _tokenUtils.isWord)('?¿')).toBeFalsy();
});
describe('Raw token processing', () => {
  test('mergeSimilarTokens', () => {
    expect((0, _tokenUtils.mergeSimilarCharsetTokens)(['_', '__', '_', 'abc'], ['_'])).toEqual(['____', 'abc']);
    expect((0, _tokenUtils.mergeSimilarCharsetTokens)(['13', 'lo', '34', '56'], ['[0-9]'])).toEqual(['13', 'lo', '3456']);
    expect((0, _tokenUtils.mergeSimilarCharsetTokens)(['ab', '34', '4f6', '4'], ['[a-z]', '[0-9]'])).toEqual(['ab344f64']);
    expect((0, _tokenUtils.mergeSimilarCharsetTokens)(['gsa', '2', '3', 'he', '1', 'helko', '34', '56', '7'], ['[0-9]'])).toEqual(['gsa', '23', 'he', '1', 'helko', '34567']);
    expect((0, _tokenUtils.mergeSimilarCharsetTokens)(['#$', '^&', '!)'], '\\!,\\@,\\#,\\$,\\%,\\?,\\^,\\&,\\*,\\(,\\)'.split(','))).toEqual(['#$^&!)']);
    expect((0, _tokenUtils.mergeSimilarCharsetTokens)(['lol', 'ha', 'ha', 'nop', 'funny'], ['lol', 'ha', 'funny'])).toEqual(['lolhaha', 'nop', 'funny']);
    expect((0, _tokenUtils.mergeSimilarCharsetTokens)(['ce', 'ci', 'est', 'très', _tokenUtils.SPACE, 'vanil', 'lé', '#', '12', '3', 'bås', 'Stra', 'ße'], _chars.LATIN_CHARSET)).toEqual(['ceciesttrès', _tokenUtils.SPACE, 'vanillé', '#', '123båsStraße']);
  });
  test('mergeSimilarTokens with custom matcher', () => {
    expect((0, _tokenUtils.mergeSimilarCharsetTokens)(['ce', 'ci', 'est', 'très', 'vanil', 'lé'], _chars.LATIN_CHARSET, t => t == 'ci' || t == 'lé')).toEqual(['ceci', 'est', 'très', 'vanillé']);

    const notInVocab = t => !{
      ce: 1,
      ci: 1,
      est: 1
    }[t];

    expect((0, _tokenUtils.mergeSimilarCharsetTokens)(['ce', 'ci', 'est', 'très', 'vanil', 'lé'], _chars.LATIN_CHARSET, notInVocab)).toEqual(['ce', 'ci', 'esttrèsvanillé']);
  });
  test('processUtteranceTokens', () => {
    const toks = [`${_tokenUtils.SPACE}my`, `${_tokenUtils.SPACE}name`, `${_tokenUtils.SPACE}${_tokenUtils.SPACE}${_tokenUtils.SPACE}`, `${_tokenUtils.SPACE}is`, `${_tokenUtils.SPACE}34`, '98', `${_tokenUtils.SPACE}98`, `${_tokenUtils.SPACE}Hei`, 'Sen', 'berg', `!&$`, `!¿}{@~`];
    expect((0, _tokenUtils.processUtteranceTokens)(toks)).toEqual(['my', '▁', 'name', '▁▁▁▁', 'is', '▁', '3498', '▁', '98', '▁', 'HeiSenberg', '!&$!¿}{@~']);
    const moreToks = [`${_tokenUtils.SPACE}jag`, `${_tokenUtils.SPACE}ä`, `r`, `${_tokenUtils.SPACE}väl`, `digt`, `${_tokenUtils.SPACE}hungrig`];
    expect((0, _tokenUtils.processUtteranceTokens)(moreToks)).toEqual(['jag', _tokenUtils.SPACE, 'är', _tokenUtils.SPACE, 'väldigt', _tokenUtils.SPACE, 'hungrig']);
  });
  test('restoreUtteranceTokens', () => {
    const original = 'I left NASA to work at Botpress';
    const tokens = ['i', _tokenUtils.SPACE, 'left', _tokenUtils.SPACE, 'nasa', _tokenUtils.SPACE, 'to', _tokenUtils.SPACE, 'work', _tokenUtils.SPACE, 'at', _tokenUtils.SPACE, 'bot', 'press'];
    expect((0, _tokenUtils.restoreOriginalUtteranceCasing)(tokens, original)).toEqual(['I', _tokenUtils.SPACE, 'left', _tokenUtils.SPACE, 'NASA', _tokenUtils.SPACE, 'to', _tokenUtils.SPACE, 'work', _tokenUtils.SPACE, 'at', _tokenUtils.SPACE, 'Bot', 'press']);
  });
});
//# sourceMappingURL=token-utils.test.js.map