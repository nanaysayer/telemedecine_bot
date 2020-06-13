"use strict";

var _tokenUtils = require("../tools/token-utils");

var _trainingPipeline = require("../training-pipeline");

var _utterance = _interopRequireDefault(require("../utterance/utterance"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const LIST_ENTITIES = [{
  entityName: 'flights',
  type: 'custom.list',
  fuzzyTolerance: 0.8,
  id: 'entId',
  mappingsTokens: {
    'Air Canada': [['Air', _tokenUtils.SPACE, 'Canada'], ['air', 'can']]
  },
  languageCode: 'en',
  sensitive: false
}];
const u1Toks = 'Hello my friend my name is Carl'.split(/(\s)/);
const u2Toks = 'hello Anthony you look different. Anything new?'.split(/(\s)/);

const genMockVectors = toks => new Array(toks.length).fill([0, 0]);

const genMockPOS = toks => new Array(toks.length).fill('N/A');

describe('Build intent vocab', () => {
  test('Empty vocab', () => {
    expect((0, _trainingPipeline.buildIntentVocab)([], [])).toEqual({});
  });
  test('With list entities only', () => {
    const intVocab = (0, _trainingPipeline.buildIntentVocab)([], LIST_ENTITIES);
    expect(intVocab['hello']).toBeUndefined();
    expect(intVocab[_tokenUtils.SPACE]).toBeUndefined();
    expect(intVocab[' ']).toBeTruthy();
    expect(intVocab['air']).toBeTruthy();
    expect(intVocab['Air']).toBeUndefined();
    expect(intVocab['Air Canada']).toBeUndefined();
    expect(intVocab['air canada']).toBeUndefined();
    expect(intVocab['Canada']).toBeUndefined();
    expect(intVocab['canada']).toBeTruthy();
    expect(intVocab['can']).toBeTruthy();
  });
  test('With utterance tokens only', () => {
    const u1 = new _utterance.default(u1Toks, genMockVectors(u1Toks), genMockPOS(u1Toks), 'en');
    const u2 = new _utterance.default(u2Toks, genMockVectors(u2Toks), genMockPOS(u2Toks), 'en');
    const intVocab = (0, _trainingPipeline.buildIntentVocab)([u1, u2], []);
    const allUtoks = [...u1Toks, ...u2Toks];
    expect(intVocab['air']).toBeUndefined();
    expect(intVocab['Air']).toBeUndefined();
    expect(intVocab['Air Canada']).toBeUndefined();
    expect(intVocab['air canada']).toBeUndefined();
    expect(intVocab['Canada']).toBeUndefined();
    expect(intVocab['canada']).toBeUndefined();
    expect(intVocab['can']).toBeUndefined();
    allUtoks.map(t => t.toLowerCase()).forEach(t => {
      expect(intVocab[t]).toBeTruthy();
    });
  });
  test('With list entities and Utterance tokens', () => {
    const u1 = new _utterance.default(u1Toks, genMockVectors(u1Toks), genMockPOS(u1Toks), 'en');
    const u2 = new _utterance.default(u2Toks, genMockVectors(u2Toks), genMockPOS(u2Toks), 'en');
    const intVocab = (0, _trainingPipeline.buildIntentVocab)([u1, u2], LIST_ENTITIES);
    const allUtoks = [...u1Toks, ...u2Toks];
    expect(intVocab[_tokenUtils.SPACE]).toBeUndefined();
    expect(intVocab[' ']).toBeTruthy();
    expect(intVocab['air']).toBeTruthy();
    expect(intVocab['Air']).toBeUndefined();
    expect(intVocab['Air Canada']).toBeUndefined();
    expect(intVocab['air canada']).toBeUndefined();
    expect(intVocab['Canada']).toBeUndefined();
    expect(intVocab['canada']).toBeTruthy();
    expect(intVocab['can']).toBeTruthy();
    allUtoks.map(t => t.toLowerCase()).forEach(t => {
      expect(intVocab[t]).toBeTruthy();
    });
  });
  test('Some tokens with tagged slots', () => {
    const u1 = new _utterance.default(u1Toks, genMockVectors(u1Toks), genMockPOS(u1Toks), 'en');
    u1.tagSlot({
      name: 'person'
    }, 6, 16); // slot is: "my friend"

    const intVocab = (0, _trainingPipeline.buildIntentVocab)([u1], []);
    expect(intVocab['friend']).toBeUndefined(); // not added because there's a slot

    expect(intVocab['my']).toBeTruthy(); // my is added because of its 2nd appearance
  });
});
//# sourceMappingURL=intent-vocab.test.js.map