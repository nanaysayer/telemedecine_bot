"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.crossValidate = crossValidate;

var _lodash = _interopRequireDefault(require("lodash"));

var _engine = _interopRequireDefault(require("../engine"));

var _trainingPipeline = require("../training-pipeline");

var _typings = require("../typings");

var _utterance = require("../utterance/utterance");

var _f1Scorer = _interopRequireDefault(require("./f1-scorer"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const seedrandom = require('seedrandom');

const TRAIN_SET_SIZE = 0.8;

async function makeIntentTestSet(rawUtts, ctxs, intent, lang) {
  const utterances = await (0, _utterance.buildUtteranceBatch)(rawUtts, lang, _engine.default.tools);
  return utterances.map(utterance => ({
    utterance,
    ctxs,
    intent
  }));
}

async function splitSet(language, intents) {
  const lo = _lodash.default.runInContext(); // so seed is applied


  let testSet = [];
  const trainSet = (await Promise.map(intents, async i => {
    // split data & preserve distribution
    const nTrain = Math.floor(TRAIN_SET_SIZE * i.utterances[language].length);

    if (nTrain < _trainingPipeline.MIN_NB_UTTERANCES) {
      return; // filter out thouse without enough data
    }

    const utterances = lo.shuffle(i.utterances[language]);
    const trainUtts = utterances.slice(0, nTrain);
    const iTestSet = await makeIntentTestSet(utterances.slice(nTrain), i.contexts, i.name, language);
    testSet = [...testSet, ...iTestSet];
    return { ...i,
      utterances: {
        [language]: trainUtts
      }
    };
  })).filter(Boolean);
  return [trainSet, testSet];
}

function recordSlots(testU, extractedSlots, f1Scorer) {
  const slotList = _lodash.default.values(extractedSlots);

  for (const tok of testU.tokens) {
    const actual = _lodash.default.get(slotList.find(s => s.start <= tok.offset && s.end >= tok.offset + tok.value.length), 'name', _typings.BIO.OUT);

    const expected = _lodash.default.get(tok, 'slots.0.name', _typings.BIO.OUT);

    f1Scorer.record(actual, expected);
  }
} // pass k for k-fold is results are not significant


async function crossValidate(botId, intents, entities, language) {
  seedrandom('confusion', {
    global: true
  });
  const [trainSet, testSet] = await splitSet(language, intents);
  const engine = new _engine.default(language, botId);
  await engine.train(trainSet, entities, language);

  const allCtx = _lodash.default.chain(intents).flatMap(i => i.contexts).uniq().value();

  const intentF1Scorers = _lodash.default.chain(allCtx).thru(ctxs => ctxs.length > 1 ? ['all', ...ctxs] : ctxs).reduce((byCtx, ctx) => ({ ...byCtx,
    [ctx]: new _f1Scorer.default()
  }), {}).value();

  const slotsF1Scorer = new _f1Scorer.default();
  const intentMap = intents.reduce((map, i) => ({ ...map,
    [i.name]: i
  }), {});

  for (const ex of testSet) {
    for (const ctx of ex.ctxs) {
      const res = await engine.predict(ex.utterance.toString(), [ctx]);
      intentF1Scorers[ctx].record(res.intent.name, ex.intent);
      const intentHasSlots = !!intentMap[ex.intent].slots.length;

      if (intentHasSlots) {
        recordSlots(ex.utterance, res.slots, slotsF1Scorer);
      }
    }

    if (allCtx.length > 1) {
      const res = await engine.predict(ex.utterance.toString(), allCtx);
      intentF1Scorers['all'].record(res.intent.name, ex.intent);
    }
  }

  seedrandom();
  return {
    intents: _lodash.default.fromPairs(_lodash.default.toPairs(intentF1Scorers).map(([ctx, scorer]) => [ctx, scorer.getResults()])),
    slots: slotsF1Scorer.getResults()
  };
}
//# sourceMappingURL=cross-validation.js.map