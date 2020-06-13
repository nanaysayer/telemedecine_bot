"use strict";

var _tokenUtils = require("../tools/token-utils");

var _posTagger = require("./pos-tagger");

describe('POS Tagger', () => {
  test('Fallback tagger returns NA tags properly', () => {
    const feats = [['feat1=1', 'feat2'], ['feat1=2'], ['feat1=3', 'feat2']];

    const {
      probability,
      result: tags
    } = _posTagger.fallbackTagger.tag(feats);

    expect(probability).toEqual(1);
    expect(tags.every(t => t === 'N/A')).toBeTruthy();

    _posTagger.fallbackTagger.marginal(feats).forEach(res => {
      expect(res).toEqual({
        'N/A': 1
      });
    });
  });
  test('Get tagger returns FB tagger for other languages than english', () => {
    const tagger = (0, _posTagger.getPOSTagger)('de', {});
    expect(tagger).toEqual(_posTagger.fallbackTagger);
  });
  describe('tagSentence', () => {
    const mockedTagger = { ..._posTagger.fallbackTagger,
      tag: jest.fn(xseq => _posTagger.fallbackTagger.tag(xseq))
    };
    test('Calls tagger without spaces and adds _ for space tokens', () => {
      const xseq = (0, _tokenUtils.tokenizeLatinTextForTests)('A Sea Fox is a Fox-alien-fish crossbreed with a strange amalgamation of a bunch of different animals and plants');
      const n_space = xseq.filter(t => (0, _tokenUtils.isSpace)(t)).length;
      const tags = (0, _posTagger.tagSentence)(mockedTagger, xseq);
      expect(mockedTagger.tag.mock.calls[0][0].length).toEqual(xseq.length - n_space);
      expect(tags.filter(t => (0, _tokenUtils.isSpace)(t)).length).toEqual(n_space);
      tags.filter(t => !(0, _tokenUtils.isSpace)(t)).forEach(t => {
        expect(t).toEqual('N/A'); // return value of the mocked tagger
      });
    });
  });
});
//# sourceMappingURL=pos-tagger.test.js.map