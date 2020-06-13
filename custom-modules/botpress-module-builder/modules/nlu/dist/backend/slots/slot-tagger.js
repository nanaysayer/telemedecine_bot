"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.labelizeUtterance = labelizeUtterance;
exports.predictionLabelToTagResult = predictionLabelToTagResult;
exports.removeInvalidTagsForIntent = removeInvalidTagsForIntent;
exports.makeExtractedSlots = makeExtractedSlots;
exports.default = void 0;

var _fs = _interopRequireDefault(require("fs"));

var _lodash = _interopRequireDefault(require("lodash"));

var _tmp = _interopRequireDefault(require("tmp"));

var _typings = require("../typings");

var featurizer = _interopRequireWildcard(require("./slot-featurizer"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const debugTrain = DEBUG('nlu').sub('training');
const debugExtract = DEBUG('nlu').sub('extract');
const CRF_TRAINER_PARAMS = {
  c1: '0.0001',
  c2: '0.01',
  max_iterations: '500',
  'feature.possible_transitions': '1',
  'feature.possible_states': '1'
};
const MIN_SLOT_CONFIDENCE = 0.15;

function labelizeUtterance(utterance) {
  return utterance.tokens.filter(x => !x.isSpace).map(token => {
    if (_lodash.default.isEmpty(token.slots)) {
      return _typings.BIO.OUT;
    }

    const slot = token.slots[0];
    const tag = slot.startTokenIdx === token.index ? _typings.BIO.BEGINNING : _typings.BIO.INSIDE;
    const any = _lodash.default.isEmpty(token.entities) ? '/any' : '';
    return `${tag}-${slot.name}${any}`;
  });
}

function predictionLabelToTagResult(prediction) {
  const [label, probability] = _lodash.default.chain(prediction).mapValues((value, key) => value + (prediction[key + '/any'] || 0)).toPairs().maxBy('1').value();

  return {
    tag: label[0],
    name: label.slice(2).replace('/any', ''),
    probability
  };
}

function removeInvalidTagsForIntent(intent, tag) {
  if (tag.tag === _typings.BIO.OUT) {
    return tag;
  }

  const foundInSlotDef = !!intent.slot_definitions.find(s => s.name === tag.name);

  if (tag.probability < MIN_SLOT_CONFIDENCE || !foundInSlotDef) {
    tag = {
      tag: _typings.BIO.OUT,
      name: '',
      probability: 1 - tag.probability // anything would do here

    };
  }

  return tag;
}

function makeExtractedSlots(intent, utterance, slotTagResults) {
  return _lodash.default.zip(utterance.tokens.filter(t => !t.isSpace), slotTagResults).filter(([token, tagRes]) => tagRes.tag !== _typings.BIO.OUT).reduce((combined, [token, tagRes]) => {
    const last = _lodash.default.last(combined);

    const shouldConcatWithPrev = tagRes.tag === _typings.BIO.INSIDE && _lodash.default.get(last, 'slot.name') === tagRes.name;

    if (shouldConcatWithPrev) {
      const newEnd = token.offset + token.value.length;
      const newSource = utterance.toString({
        entities: 'keep-default'
      }).slice(last.start, newEnd); // we use slice in case tokens are space split

      last.slot.source = newSource;
      last.slot.value = newSource;
      last.end = newEnd;
      return [...combined.slice(0, -1), last];
    } else {
      return [...combined, {
        slot: {
          name: tagRes.name,
          confidence: tagRes.probability,
          source: token.toString(),
          value: token.toString()
        },
        start: token.offset,
        end: token.offset + token.value.length
      }];
    }
  }, []).map(extracted => {
    const associatedEntityInRange = utterance.entities.find(e => (e.startPos <= extracted.start && e.endPos >= extracted.end || // entity is fully within the tagged slot
    e.startPos >= extracted.start && e.endPos <= extracted.end) && // slot is fully contained by an entity
    _lodash.default.includes(intent.slot_entities, e.type) // entity is part of the possible entities
    );

    if (associatedEntityInRange) {
      extracted.slot.value = associatedEntityInRange.value;
    }

    return extracted;
  });
}

class SlotTagger {
  constructor(mlToolkit) {
    this.mlToolkit = mlToolkit;

    _defineProperty(this, "_crfModelFn", '');

    _defineProperty(this, "_crfTagger", void 0);
  }

  load(crf) {
    this._crfModelFn = _tmp.default.tmpNameSync();

    _fs.default.writeFileSync(this._crfModelFn, crf);

    this._readTagger();
  }

  _readTagger() {
    this._crfTagger = this.mlToolkit.CRF.createTagger();

    this._crfTagger.open(this._crfModelFn);
  }

  async train(intents) {
    const elements = [];

    for (const intent of intents) {
      for (const utterance of intent.utterances) {
        const features = utterance.tokens.filter(x => !x.isSpace).map(this.tokenSliceFeatures.bind(this, intent, utterance, false));
        const labels = labelizeUtterance(utterance);
        elements.push({
          features,
          labels
        });
      }
    }

    const trainer = this.mlToolkit.CRF.createTrainer();
    this._crfModelFn = await trainer.train(elements, CRF_TRAINER_PARAMS);
  }

  get serialized() {
    return (async () => await Promise.fromCallback(cb => _fs.default.readFile(this._crfModelFn, cb)))();
  }

  tokenSliceFeatures(intent, utterance, isPredict, token) {
    const previous = utterance.tokens.filter(t => t.index < token.index && !t.isSpace).slice(-2);
    const next = utterance.tokens.filter(t => t.index > token.index && !t.isSpace).slice(0, 1);
    const prevFeats = previous.map(t => this._getTokenFeatures(intent, utterance, t, isPredict).filter(f => f.name !== 'quartile').reverse());

    const current = this._getTokenFeatures(intent, utterance, token, isPredict).filter(f => f.name !== 'cluster');

    const nextFeats = next.map(t => this._getTokenFeatures(intent, utterance, t, isPredict).filter(f => f.name !== 'quartile'));
    const prevPairs = prevFeats.length ? featurizer.getFeatPairs(prevFeats[0], current, ['word', 'vocab', 'weight', 'POS']) : [];
    const nextPairs = nextFeats.length ? featurizer.getFeatPairs(current, nextFeats[0], ['word', 'vocab', 'weight', 'POS']) : [];
    const intentFeat = featurizer.getIntentFeature(intent);
    const bos = token.isBOS ? ['__BOS__'] : [];
    const eos = token.isEOS ? ['__EOS__'] : [];
    return [...bos, featurizer.featToCRFsuiteAttr('', intentFeat), ..._lodash.default.flatten(prevFeats.map((feat, idx) => feat.map(featurizer.featToCRFsuiteAttr.bind(this, `w[-${idx + 1}]`)))), ...current.map(featurizer.featToCRFsuiteAttr.bind(this, 'w[0]')), ..._lodash.default.flatten(nextFeats.map((feat, idx) => feat.map(featurizer.featToCRFsuiteAttr.bind(this, `w[${idx + 1}]`)))), ...prevPairs.map(featurizer.featToCRFsuiteAttr.bind(this, 'w[-1]|w[0]')), ...nextPairs.map(featurizer.featToCRFsuiteAttr.bind(this, 'w[0]|w[1]')), ...eos];
  }

  _getTokenFeatures(intent, utterance, token, isPredict) {
    if (!token || !token.value) {
      return [];
    }

    return [featurizer.getTokenQuartile(utterance, token), featurizer.getClusterFeat(token), featurizer.getWordWeight(token), featurizer.getInVocabFeat(token, intent), featurizer.getSpaceFeat(utterance.tokens[token.index - 1]), featurizer.getAlpha(token), featurizer.getNum(token), featurizer.getSpecialChars(token), featurizer.getWordFeat(token, isPredict), featurizer.getPOSFeat(token), ...featurizer.getEntitiesFeats(token, intent.slot_entities, isPredict)].filter(_lodash.default.identity); // some features can be undefined
  }

  getSequenceFeatures(intent, utterance, isPredict) {
    return _lodash.default.chain(utterance.tokens).filter(t => !t.isSpace).map(t => this.tokenSliceFeatures(intent, utterance, isPredict, t)).value();
  }

  async extract(utterance, intent) {
    const features = this.getSequenceFeatures(intent, utterance, true);
    debugExtract('vectorize', features);

    const predictions = this._crfTagger.marginal(features);

    debugExtract('slot crf predictions', predictions);
    return _lodash.default.chain(predictions).map(predictionLabelToTagResult).map(tagRes => removeInvalidTagsForIntent(intent, tagRes)).thru(tagRess => makeExtractedSlots(intent, utterance, tagRess)).value();
  }

}

exports.default = SlotTagger;
//# sourceMappingURL=slot-tagger.js.map