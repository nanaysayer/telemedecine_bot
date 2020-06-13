"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.findExactIntentForCtx = findExactIntentForCtx;
exports.Predict = exports.InvalidLanguagePredictorError = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

var _customEntityExtractor = require("./entities/custom-entity-extractor");

var _contextClassifierFeaturizer = require("./intents/context-classifier-featurizer");

var _languageIdentifier = _interopRequireWildcard(require("./language/language-identifier"));

var _posTagger = require("./language/pos-tagger");

var _outOfScopeFeaturizer = require("./out-of-scope-featurizer");

var math = _interopRequireWildcard(require("./tools/math"));

var _strings = require("./tools/strings");

var _trainingPipeline = require("./training-pipeline");

var _utterance = require("./utterance/utterance");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const DEFAULT_CTX = 'global';
const NONE_INTENT = 'none';
const OOS_AS_NONE_TRESH = 0.3;
const LOW_INTENT_CONFIDENCE_TRESH = 0.4;

async function DetectLanguage(input, predictorsByLang, tools) {
  var _ref;

  const supportedLanguages = Object.keys(predictorsByLang);

  const langIdentifier = _languageIdentifier.default.getLanguageIdentifier(tools.mlToolkit);

  const lidRes = await langIdentifier.identify(input.sentence);
  const elected = lidRes.filter(pred => supportedLanguages.includes(pred.label))[0];
  let score = (_ref = elected === null || elected === void 0 ? void 0 : elected.value) !== null && _ref !== void 0 ? _ref : 0; // because with single-worded sentences, confidence is always very low
  // we assume that a input of 20 chars is more than a single word

  const threshold = input.sentence.length > 20 ? 0.5 : 0.3;

  let detectedLanguage = _lodash.default.get(elected, 'label', _languageIdentifier.NA_LANG);

  if (detectedLanguage !== _languageIdentifier.NA_LANG && !supportedLanguages.includes(detectedLanguage)) {
    detectedLanguage = _languageIdentifier.NA_LANG;
  } // if ML-based language identifier didn't find a match
  // we proceed with a custom vocabulary matching algorithm
  // ie. the % of the sentence comprised of tokens in the training vocabulary


  if (detectedLanguage === _languageIdentifier.NA_LANG) {
    try {
      const match = _lodash.default.chain(supportedLanguages).map(lang => ({
        lang,
        sentence: input.sentence.toLowerCase(),
        tokens: _lodash.default.orderBy(Object.keys(predictorsByLang[lang].vocabVectors), 'length', 'desc')
      })).map(({
        lang,
        sentence,
        tokens
      }) => {
        for (const token of tokens) {
          sentence = sentence.replace(token, '');
        }

        return {
          lang,
          confidence: 1 - sentence.length / input.sentence.length
        };
      }).filter(x => x.confidence >= threshold).orderBy('confidence', 'desc').first().value();

      if (match) {
        detectedLanguage = match.lang;
        score = match.confidence;
      }
    } finally {}
  }

  const usedLanguage = detectedLanguage !== _languageIdentifier.NA_LANG && score > threshold ? detectedLanguage : input.defaultLanguage;
  return {
    usedLanguage,
    detectedLanguage
  };
}

async function preprocessInput(input, tools, predictorsBylang) {
  const {
    detectedLanguage,
    usedLanguage
  } = await DetectLanguage(input, predictorsBylang, tools);
  const predictors = predictorsBylang[usedLanguage];

  if (_lodash.default.isEmpty(predictors)) {
    // eventually better validation than empty check
    throw new InvalidLanguagePredictorError(usedLanguage);
  }

  const contexts = input.includedContexts.filter(x => predictors.contexts.includes(x));
  const stepOutput = {
    includedContexts: _lodash.default.isEmpty(contexts) ? predictors.contexts : contexts,
    rawText: input.sentence,
    detectedLanguage,
    languageCode: usedLanguage
  };
  return {
    stepOutput,
    predictors
  };
}

async function makePredictionUtterance(input, predictors, tools) {
  const {
    tfidf,
    vocabVectors,
    kmeans
  } = predictors;
  const text = (0, _strings.replaceConsecutiveSpaces)(input.rawText.trim());
  const [utterance] = await (0, _utterance.buildUtteranceBatch)([text], input.languageCode, tools, vocabVectors);
  const alternateUtterance = (0, _utterance.getAlternateUtterance)(utterance, vocabVectors);
  Array(utterance, alternateUtterance).filter(Boolean).forEach(u => {
    u.setGlobalTfidf(tfidf);
    u.setKmeans(kmeans);
  });
  return { ...input,
    utterance,
    alternateUtterance
  };
}

async function extractEntities(input, predictors, tools) {
  const {
    utterance,
    alternateUtterance
  } = input;

  _lodash.default.forEach([...(0, _customEntityExtractor.extractListEntities)(input.utterance, predictors.list_entities, true), ...(0, _customEntityExtractor.extractPatternEntities)(utterance, predictors.pattern_entities), ...(await tools.duckling.extract(utterance.toString(), utterance.languageCode))], entityRes => {
    input.utterance.tagEntity(_lodash.default.omit(entityRes, ['start, end']), entityRes.start, entityRes.end);
  });

  if (alternateUtterance) {
    _lodash.default.forEach([...(0, _customEntityExtractor.extractListEntities)(alternateUtterance, predictors.list_entities), ...(0, _customEntityExtractor.extractPatternEntities)(alternateUtterance, predictors.pattern_entities), ...(await tools.duckling.extract(alternateUtterance.toString(), utterance.languageCode))], entityRes => {
      input.alternateUtterance.tagEntity(_lodash.default.omit(entityRes, ['start, end']), entityRes.start, entityRes.end);
    });
  }

  return { ...input
  };
}

async function predictContext(input, predictors) {
  const classifier = predictors.ctx_classifier;

  if (!classifier) {
    return { ...input,
      ctx_predictions: [{
        label: input.includedContexts.length ? input.includedContexts[0] : DEFAULT_CTX,
        confidence: 1
      }]
    };
  }

  const features = (0, _contextClassifierFeaturizer.getSentenceEmbeddingForCtx)(input.utterance);
  let ctx_predictions = await classifier.predict(features);

  if (input.alternateUtterance) {
    var _ref2, _alternatePreds$;

    const alternateFeats = (0, _contextClassifierFeaturizer.getSentenceEmbeddingForCtx)(input.alternateUtterance);
    const alternatePreds = await classifier.predict(alternateFeats); // we might want to do this in intent election intead or in NDU

    if ((_ref2 = alternatePreds && ((_alternatePreds$ = alternatePreds[0]) === null || _alternatePreds$ === void 0 ? void 0 : _alternatePreds$.confidence)) !== null && _ref2 !== void 0 ? _ref2 : 0 > ctx_predictions[0].confidence) {
      // mean
      ctx_predictions = _lodash.default.chain([...alternatePreds, ...ctx_predictions]).groupBy('label').mapValues(gr => _lodash.default.meanBy(gr, 'confidence')).toPairs().map(([label, confidence]) => ({
        label,
        confidence
      })).value();
    }
  }

  return { ...input,
    ctx_predictions
  };
}

async function predictIntent(input, predictors) {
  if (predictors.intents.length === 0) {
    return { ...input,
      intent_predictions: {
        per_ctx: {
          [DEFAULT_CTX]: [{
            label: NONE_INTENT,
            confidence: 1
          }]
        }
      }
    };
  }

  const ctxToPredict = input.ctx_predictions.map(p => p.label);
  const predictions = (await Promise.map(ctxToPredict, async ctx => {
    const predictor = predictors.intent_classifier_per_ctx[ctx];

    if (!predictor) {
      return;
    }

    const features = [...input.utterance.sentenceEmbedding, input.utterance.tokens.length];
    let preds = await predictor.predict(features);
    const exactPred = findExactIntentForCtx(predictors.exact_match_index, input.utterance, ctx);

    if (exactPred) {
      const idxToRemove = preds.findIndex(p => p.label === exactPred.label);
      preds.splice(idxToRemove, 1);
      preds.unshift(exactPred);
    }

    if (input.alternateUtterance) {
      var _ref3, _alternatePreds$2;

      const alternateFeats = [...input.alternateUtterance.sentenceEmbedding, input.alternateUtterance.tokens.length];
      const alternatePreds = await predictor.predict(alternateFeats);
      const exactPred = findExactIntentForCtx(predictors.exact_match_index, input.alternateUtterance, ctx);

      if (exactPred) {
        const idxToRemove = alternatePreds.findIndex(p => p.label === exactPred.label);
        alternatePreds.splice(idxToRemove, 1);
        alternatePreds.unshift(exactPred);
      } // we might want to do this in intent election intead or in NDU


      if ((_ref3 = alternatePreds && ((_alternatePreds$2 = alternatePreds[0]) === null || _alternatePreds$2 === void 0 ? void 0 : _alternatePreds$2.confidence)) !== null && _ref3 !== void 0 ? _ref3 : 0 >= preds[0].confidence) {
        // mean
        preds = _lodash.default.chain([...alternatePreds, ...preds]).groupBy('label').mapValues(gr => _lodash.default.meanBy(gr, 'confidence')).toPairs().map(([label, confidence]) => ({
          label,
          confidence
        })).value();
      }
    }

    return preds;
  })).filter(_lodash.default.identity);
  return { ...input,
    intent_predictions: {
      per_ctx: _lodash.default.zipObject(ctxToPredict, predictions)
    }
  };
} // taken from svm classifier #295
// this means that the 3 best predictions are really close, do not change magic numbers


function predictionsReallyConfused(predictions) {
  if (predictions.length <= 2) {
    return false;
  }

  const std = math.std(predictions.map(p => p.confidence));
  const diff = (predictions[0].confidence - predictions[1].confidence) / std;

  if (diff >= 2.5) {
    return false;
  }

  const bestOf3STD = math.std(predictions.slice(0, 3).map(p => p.confidence));
  return bestOf3STD <= 0.03;
} // TODO implement this algorithm properly / improve it
// currently taken as is from svm classifier (engine 1) and doesn't make much sens


function electIntent(input) {
  var _input$oos_prediction3;

  const totalConfidence = Math.min(1, _lodash.default.sumBy(input.ctx_predictions.filter(x => input.includedContexts.includes(x.label)), 'confidence'));
  const ctxPreds = input.ctx_predictions.map(x => ({ ...x,
    confidence: x.confidence / totalConfidence
  })); // taken from svm classifier #349

  let predictions = _lodash.default.chain(ctxPreds).flatMap(({
    label: ctx,
    confidence: ctxConf
  }) => {
    const intentPreds = _lodash.default.chain(input.intent_predictions.per_ctx[ctx] || []).thru(preds => {
      var _input$oos_prediction;

      if (((_input$oos_prediction = input.oos_predictions) === null || _input$oos_prediction === void 0 ? void 0 : _input$oos_prediction.confidence) > OOS_AS_NONE_TRESH) {
        var _ref4, _input$oos_prediction2;

        return [...preds, {
          label: NONE_INTENT,
          confidence: (_ref4 = (_input$oos_prediction2 = input.oos_predictions) === null || _input$oos_prediction2 === void 0 ? void 0 : _input$oos_prediction2.confidence) !== null && _ref4 !== void 0 ? _ref4 : 1,
          context: ctx,
          l0Confidence: ctxConf
        }];
      } else {
        return preds;
      }
    }).map(p => ({ ...p,
      confidence: _lodash.default.round(p.confidence, 2)
    })).orderBy('confidence', 'desc').value();

    if (intentPreds[0].confidence === 1 || intentPreds.length === 1) {
      return [{
        label: intentPreds[0].label,
        l0Confidence: ctxConf,
        context: ctx,
        confidence: 1
      }];
    } // are we sure theres always at least two intents ? otherwise down there it may crash


    if (predictionsReallyConfused(intentPreds)) {
      intentPreds.unshift({
        label: NONE_INTENT,
        context: ctx,
        confidence: 1
      });
    }

    const lnstd = math.std(intentPreds.filter(x => x.confidence !== 0).map(x => Math.log(x.confidence))); // because we want a lognormal distribution

    let p1Conf = math.GetZPercent((Math.log(intentPreds[0].confidence) - Math.log(intentPreds[1].confidence)) / lnstd);

    if (isNaN(p1Conf)) {
      p1Conf = 0.5;
    }

    return [{
      label: intentPreds[0].label,
      l0Confidence: ctxConf,
      context: ctx,
      confidence: _lodash.default.round(ctxConf * p1Conf, 3)
    }, {
      label: intentPreds[1].label,
      l0Confidence: ctxConf,
      context: ctx,
      confidence: _lodash.default.round(ctxConf * (1 - p1Conf), 3)
    }];
  }).orderBy('confidence', 'desc').filter(p => input.includedContexts.includes(p.context)).uniqBy(p => p.label).map(p => ({
    name: p.label,
    context: p.context,
    confidence: p.confidence
  })).value();

  const ctx = _lodash.default.get(predictions, '0.context', 'global');

  const shouldConsiderOOS = predictions.length && predictions[0].name !== NONE_INTENT && predictions[0].confidence < LOW_INTENT_CONFIDENCE_TRESH && ((_input$oos_prediction3 = input.oos_predictions) === null || _input$oos_prediction3 === void 0 ? void 0 : _input$oos_prediction3.confidence) > OOS_AS_NONE_TRESH;

  if (!predictions.length || shouldConsiderOOS) {
    var _ref5, _input$oos_prediction4;

    predictions = _lodash.default.orderBy([...predictions.filter(p => p.name !== NONE_INTENT), {
      name: NONE_INTENT,
      context: ctx,
      confidence: (_ref5 = (_input$oos_prediction4 = input.oos_predictions) === null || _input$oos_prediction4 === void 0 ? void 0 : _input$oos_prediction4.confidence) !== null && _ref5 !== void 0 ? _ref5 : 1
    }], 'confidence');
  }

  return _lodash.default.merge(input, {
    intent_predictions: {
      combined: predictions,
      elected: _lodash.default.maxBy(predictions, 'confidence')
    }
  });
}

async function predictOutOfScope(input, predictors, tools) {
  if (!(0, _posTagger.isPOSAvailable)(input.languageCode) || !predictors.oos_classifier) {
    return input;
  }

  const utt = input.alternateUtterance || input.utterance;
  const feats = (0, _outOfScopeFeaturizer.getUtteranceFeatures)(utt);
  const preds = await predictors.oos_classifier.predict(feats);

  const confidence = _lodash.default.sumBy(preds.filter(p => p.label.startsWith('out')), 'confidence');

  const oos_predictions = {
    label: 'out',
    confidence
  };
  return { ...input,
    oos_predictions
  };
}

function detectAmbiguity(input) {
  // +- 10% away from perfect median leads to ambiguity
  const preds = input.intent_predictions.combined;
  const perfectConfusion = 1 / preds.length;
  const low = perfectConfusion - 0.1;
  const up = perfectConfusion + 0.1;
  const confidenceVec = preds.map(p => p.confidence);
  const ambiguous = preds.length > 1 && (math.allInRange(confidenceVec, low, up) || preds[0].name === NONE_INTENT && math.allInRange(confidenceVec.slice(1), low, up));
  return _lodash.default.merge(input, {
    intent_predictions: {
      ambiguous
    }
  });
}

async function extractSlots(input, predictors) {
  const intent = !input.intent_predictions.ambiguous && predictors.intents.find(i => i.name === input.intent_predictions.elected.name);

  if (intent && intent.slot_definitions.length > 0) {
    const slots = await predictors.slot_tagger.extract(input.utterance, intent);
    slots.forEach(({
      slot,
      start,
      end
    }) => {
      input.utterance.tagSlot(slot, start, end);
    });
  }

  const slots_per_intent = {};

  for (const intent of predictors.intents.filter(x => x.slot_definitions.length > 0)) {
    const slots = await predictors.slot_tagger.extract(input.utterance, intent);
    slots_per_intent[intent.name] = slots;
  }

  return { ...input,
    slot_predictions_per_intent: slots_per_intent
  };
}

function MapStepToOutput(step, startTime) {
  var _step$ctx_predictions, _ref6, _step$oos_predictions;

  const entities = step.utterance.entities.map(e => ({
    name: e.type,
    type: e.metadata.entityId,
    data: {
      unit: e.metadata.unit,
      value: e.value
    },
    meta: {
      confidence: e.confidence,
      end: e.endPos,
      source: e.metadata.source,
      start: e.startPos
    }
  }));
  const slots = step.utterance.slots.reduce((slots, s) => {
    return { ...slots,
      [s.name]: {
        start: s.startPos,
        end: s.endPos,
        confidence: s.confidence,
        name: s.name,
        source: s.source,
        value: s.value
      }
    };
  }, {});
  const predictions = (_step$ctx_predictions = step.ctx_predictions) === null || _step$ctx_predictions === void 0 ? void 0 : _step$ctx_predictions.reduce((preds, {
    label,
    confidence
  }) => {
    return { ...preds,
      [label]: {
        confidence: confidence,
        intents: step.intent_predictions.per_ctx[label].map(i => ({ ...i,
          slots: (step.slot_predictions_per_intent[i.label] || []).reduce((slots, s) => {
            if (slots[s.slot.name] && slots[s.slot.name].confidence > s.slot.confidence) {
              // we keep only the most confident slots
              return slots;
            }

            return { ...slots,
              [s.slot.name]: {
                start: s.start,
                end: s.end,
                confidence: s.slot.confidence,
                name: s.slot.name,
                source: s.slot.source,
                value: s.slot.value
              }
            };
          }, {})
        }))
      }
    };
  }, {
    oos: {
      intents: [{
        label: NONE_INTENT,
        confidence: 1 // this will be be computed as

      }],
      confidence: (_ref6 = (_step$oos_predictions = step.oos_predictions) === null || _step$oos_predictions === void 0 ? void 0 : _step$oos_predictions.confidence) !== null && _ref6 !== void 0 ? _ref6 : 0
    }
  });
  return {
    ambiguous: step.intent_predictions.ambiguous,
    detectedLanguage: step.detectedLanguage,
    entities,
    errored: false,
    predictions: _lodash.default.chain(predictions) // orders all predictions by confidence
    .entries().orderBy(x => x[1].confidence, 'desc').fromPairs().value(),
    includedContexts: step.includedContexts,
    intent: step.intent_predictions.elected,
    intents: step.intent_predictions.combined,
    language: step.languageCode,
    slots,
    ms: Date.now() - startTime
  };
} // TODO move this in exact match module


function findExactIntentForCtx(exactMatchIndex, utterance, ctx) {
  const candidateKey = utterance.toString(_trainingPipeline.EXACT_MATCH_STR_OPTIONS);
  const maybeMatch = exactMatchIndex[candidateKey];

  if (_lodash.default.get(maybeMatch, 'contexts', []).includes(ctx)) {
    return {
      label: maybeMatch.intent,
      confidence: 1,
      extractor: 'exact-matcher'
    };
  }
}

class InvalidLanguagePredictorError extends Error {
  constructor(languageCode) {
    super(`Predictor for language: ${languageCode} is not valid`);
    this.languageCode = languageCode;
    this.name = 'PredictorError';
  }

}

exports.InvalidLanguagePredictorError = InvalidLanguagePredictorError;

const Predict = async (input, tools, predictorsByLang) => {
  try {
    const t0 = Date.now(); // tslint:disable-next-line

    let {
      stepOutput,
      predictors
    } = await preprocessInput(input, tools, predictorsByLang);
    stepOutput = await makePredictionUtterance(stepOutput, predictors, tools);
    stepOutput = await extractEntities(stepOutput, predictors, tools);
    stepOutput = await predictOutOfScope(stepOutput, predictors, tools);
    stepOutput = await predictContext(stepOutput, predictors);
    stepOutput = await predictIntent(stepOutput, predictors);
    stepOutput = electIntent(stepOutput);
    stepOutput = detectAmbiguity(stepOutput);
    stepOutput = await extractSlots(stepOutput, predictors);
    return MapStepToOutput(stepOutput, t0);
  } catch (err) {
    if (err instanceof InvalidLanguagePredictorError) {
      throw err;
    }

    console.log('Could not perform predict data', err);
    return {
      errored: true
    };
  }
};

exports.Predict = Predict;
//# sourceMappingURL=predict-pipeline.js.map