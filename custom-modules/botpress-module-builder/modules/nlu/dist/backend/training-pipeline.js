"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Trainer = exports.TfidfTokens = exports.AppendNoneIntent = exports.ExtractEntities = exports.ProcessIntents = exports.BuildExactMatchIndex = exports.buildIntentVocab = exports.computeKmeans = exports.MIN_NB_UTTERANCES = exports.EXACT_MATCH_STR_OPTIONS = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

var _cacheManager = require("./cache-manager");

var _customEntityExtractor = require("./entities/custom-entity-extractor");

var _contextClassifierFeaturizer = require("./intents/context-classifier-featurizer");

var _posTagger = require("./language/pos-tagger");

var _stopWords = require("./language/stopWords");

var _outOfScopeFeaturizer = require("./out-of-scope-featurizer");

var _slotTagger = _interopRequireDefault(require("./slots/slot-tagger"));

var _strings = require("./tools/strings");

var _tfidf = _interopRequireDefault(require("./tools/tfidf"));

var _tokenUtils = require("./tools/token-utils");

var _utterance = require("./utterance/utterance");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debugTraining = DEBUG('nlu').sub('training');
const NONE_INTENT = 'none';
const NONE_UTTERANCES_BOUNDS = {
  MIN: 20,
  MAX: 200
};
const EXACT_MATCH_STR_OPTIONS = {
  lowerCase: true,
  onlyWords: true,
  slots: 'ignore',
  entities: 'ignore'
};
exports.EXACT_MATCH_STR_OPTIONS = EXACT_MATCH_STR_OPTIONS;
const MIN_NB_UTTERANCES = 3;
exports.MIN_NB_UTTERANCES = MIN_NB_UTTERANCES;
const NUM_CLUSTERS = 8;
const KMEANS_OPTIONS = {
  iterations: 250,
  initialization: 'random',
  seed: 666 // so training is consistent

};

const PreprocessInput = async (input, tools) => {
  debugTraining.forBot(input.botId, 'Preprocessing intents');
  input = _lodash.default.cloneDeep(input);
  const list_entities = await Promise.map(input.list_entities, list => makeListEntityModel(list, input.botId, input.languageCode, tools));
  const intents = await ProcessIntents(input.intents, input.languageCode, list_entities, tools);
  return { ..._lodash.default.omit(input, 'list_entities', 'intents'),
    list_entities,
    intents
  };
};

const makeListEntityModel = async (entity, botId, languageCode, tools) => {
  const allValues = _lodash.default.uniq(Object.keys(entity.synonyms).concat(..._lodash.default.values(entity.synonyms)));

  const allTokens = (await tools.tokenize_utterances(allValues, languageCode)).map(toks => toks.map(_tokenUtils.convertToRealSpaces));
  return {
    type: 'custom.list',
    id: `custom.list.${entity.name}`,
    languageCode: languageCode,
    entityName: entity.name,
    fuzzyTolerance: entity.fuzzyTolerance,
    sensitive: entity.sensitive,
    mappingsTokens: _lodash.default.mapValues(entity.synonyms, (synonyms, name) => [...synonyms, name].map(syn => {
      const idx = allValues.indexOf(syn);
      return allTokens[idx];
    })),
    cache: (0, _cacheManager.getOrCreateCache)(entity.name, botId)
  };
};

const computeKmeans = (intents, tools) => {
  const data = _lodash.default.chain(intents).filter(i => i.name !== NONE_INTENT).flatMapDeep(i => i.utterances.map(u => u.tokens)) // @ts-ignore
  .uniqBy(t => t.value).map(t => t.vector).value();

  if (data.length < 2) {
    return;
  }

  const k = data.length > NUM_CLUSTERS ? NUM_CLUSTERS : 2;
  return tools.mlToolkit.KMeans.kmeans(data, k, KMEANS_OPTIONS);
};

exports.computeKmeans = computeKmeans;

const ClusterTokens = (input, tools) => {
  const kmeans = computeKmeans(input.intents, tools);
  const copy = { ...input,
    kmeans
  };
  copy.intents.forEach(x => x.utterances.forEach(u => u.setKmeans(kmeans)));
  return copy;
};

const buildIntentVocab = (utterances, intentEntities) => {
  // @ts-ignore
  const entitiesTokens = _lodash.default.chain(intentEntities).flatMapDeep(e => Object.values(e.mappingsTokens)).map(t => t.toLowerCase().replace(_tokenUtils.SPACE, ' ')).value();

  return _lodash.default.chain(utterances).flatMap(u => u.tokens.filter(t => _lodash.default.isEmpty(t.slots)).map(t => t.toString({
    lowerCase: true
  }))).concat(entitiesTokens).reduce((vocab, tok) => ({ ...vocab,
    [tok]: true
  }), {}).value();
};

exports.buildIntentVocab = buildIntentVocab;

const buildVectorsVocab = intents => {
  return _lodash.default.chain(intents).filter(i => i.name !== NONE_INTENT).flatMapDeep(intent => intent.utterances.map(u => u.tokens)) // @ts-ignore
  .reduce((vocab, tok) => {
    vocab[tok.toString({
      lowerCase: true
    })] = tok.vector;
    return vocab;
  }, {}).value();
};

const BuildExactMatchIndex = input => {
  return _lodash.default.chain(input.intents).filter(i => i.name !== NONE_INTENT).flatMap(i => i.utterances.map(u => ({
    utterance: u.toString(EXACT_MATCH_STR_OPTIONS),
    contexts: i.contexts,
    intent: i.name
  }))).reduce((index, {
    utterance,
    contexts,
    intent
  }) => {
    index[utterance] = {
      intent,
      contexts
    };
    return index;
  }, {}).value();
};

exports.BuildExactMatchIndex = BuildExactMatchIndex;

const TrainIntentClassifier = async (input, tools, progress) => {
  debugTraining.forBot(input.botId, 'Training intent classifier');
  const svmPerCtx = {};

  for (let i = 0; i < input.contexts.length; i++) {
    const ctx = input.contexts[i];

    const points = _lodash.default.chain(input.intents).filter(i => i.contexts.includes(ctx) && i.utterances.length >= MIN_NB_UTTERANCES).flatMap(i => i.utterances.filter((u, idx) => i.name !== NONE_INTENT || u.tokens.length > 2 && idx % 3 === 0).map(utt => ({
      label: i.name,
      coordinates: [...utt.sentenceEmbedding, utt.tokens.length]
    }))).filter(x => !x.coordinates.some(isNaN)).value();

    if (points.length < 0) {
      progress(1 / input.contexts.length);
      continue;
    }

    const svm = new tools.mlToolkit.SVM.Trainer();
    const model = await svm.train(points, {
      kernel: 'LINEAR',
      classifier: 'C_SVC'
    }, p => {
      const completion = (i + p) / input.contexts.length;
      progress(completion);
    });
    svmPerCtx[ctx] = model;
  }

  debugTraining.forBot(input.botId, 'Done training intent classifier');
  return svmPerCtx;
};

const TrainContextClassifier = async (input, tools, progress) => {
  debugTraining.forBot(input.botId, 'Training context classifier');

  const points = _lodash.default.flatMapDeep(input.contexts, ctx => {
    return input.intents.filter(intent => intent.contexts.includes(ctx) && intent.name !== NONE_INTENT).map(intent => intent.utterances.map(utt => ({
      label: ctx,
      coordinates: (0, _contextClassifierFeaturizer.getSentenceEmbeddingForCtx)(utt)
    })));
  }).filter(x => x.coordinates.filter(isNaN).length === 0);

  if (points.length === 0 || input.contexts.length <= 1) {
    progress();
    debugTraining.forBot(input.botId, 'No context to train');
    return;
  }

  const svm = new tools.mlToolkit.SVM.Trainer();
  const model = await svm.train(points, {
    kernel: 'LINEAR',
    classifier: 'C_SVC'
  }, p => {
    progress(_lodash.default.round(p, 1));
  });
  debugTraining.forBot(input.botId, 'Done training context classifier');
  return model;
};

const ProcessIntents = async (intents, languageCode, list_entities, tools) => {
  return Promise.map(intents, async intent => {
    const cleaned = intent.utterances.map(_lodash.default.flow([_lodash.default.trim, _strings.replaceConsecutiveSpaces]));
    const utterances = await (0, _utterance.buildUtteranceBatch)(cleaned, languageCode, tools);

    const allowedEntities = _lodash.default.chain(intent.slot_definitions).flatMap(s => s.entities).filter(e => e !== 'any').uniq().value();

    const entityModels = _lodash.default.intersectionWith(list_entities, allowedEntities, (entity, name) => {
      return entity.entityName === name;
    });

    const vocab = buildIntentVocab(utterances, entityModels);
    return { ...intent,
      utterances: utterances,
      vocab,
      slot_entities: allowedEntities
    };
  });
};

exports.ProcessIntents = ProcessIntents;

const ExtractEntities = async (input, tools) => {
  const utterances = _lodash.default.chain(input.intents).filter(i => i.name !== NONE_INTENT).flatMap('utterances').value(); // we extract sys entities for all utterances, helps on training and exact matcher


  const allSysEntities = await tools.duckling.extractMultiple(utterances.map(u => u.toString()), input.languageCode, true);

  const customReferencedInSlots = _lodash.default.chain(input.intents).flatMap('slot_entities').uniq().value(); // only extract list entities referenced in slots
  // TODO: remove this once we merge in entity encoding


  const listEntitiesToExtract = input.list_entities.filter(ent => customReferencedInSlots.includes(ent.entityName));
  const pattenEntitiesToExtract = input.pattern_entities.filter(ent => customReferencedInSlots.includes(ent.name));

  _lodash.default.zip(utterances, allSysEntities).map(([utt, sysEntities]) => {
    // TODO: remove this slot check once we merge in entity encoding
    const listEntities = utt.slots.length ? (0, _customEntityExtractor.extractListEntities)(utt, listEntitiesToExtract) : [];
    const patternEntities = utt.slots.length ? (0, _customEntityExtractor.extractPatternEntities)(utt, pattenEntitiesToExtract) : [];
    return [utt, [...sysEntities, ...listEntities, ...patternEntities]];
  }).forEach(([utt, entities]) => {
    entities.forEach(ent => {
      utt.tagEntity(_lodash.default.omit(ent, ['start, end']), ent.start, ent.end);
    });
  });

  return input;
};

exports.ExtractEntities = ExtractEntities;

const AppendNoneIntent = async (input, tools) => {
  if (input.intents.length === 0) {
    return input;
  }

  const allUtterances = _lodash.default.flatten(input.intents.map(x => x.utterances));

  const vocabWithDupes = _lodash.default.chain(allUtterances).map(x => x.tokens.map(x => x.value)).flattenDeep().value();

  const junkWords = await tools.generateSimilarJunkWords(_lodash.default.uniq(vocabWithDupes), input.languageCode);

  const avgTokens = _lodash.default.meanBy(allUtterances, x => x.tokens.length);

  const nbOfNoneUtterances = _lodash.default.clamp(allUtterances.length * 2 / 3, NONE_UTTERANCES_BOUNDS.MIN, NONE_UTTERANCES_BOUNDS.MAX);

  const stopWords = await (0, _stopWords.getStopWordsForLang)(input.languageCode);

  const vocabWords = _lodash.default.chain(input.tfIdf).toPairs().filter(([word, tfidf]) => tfidf <= 0.3).map('0').value(); // If 30% in utterances is a space, language is probably space-separated so we'll join tokens using spaces


  const joinChar = vocabWithDupes.filter(x => (0, _tokenUtils.isSpace)(x)).length >= vocabWithDupes.length * 0.3 ? _tokenUtils.SPACE : '';

  const vocabUtts = _lodash.default.range(0, nbOfNoneUtterances).map(() => {
    const nbWords = Math.round(_lodash.default.random(1, avgTokens * 2, false));
    return _lodash.default.sampleSize(_lodash.default.uniq([...stopWords, ...vocabWords]), nbWords).join(joinChar);
  });

  const junkWordsUtts = _lodash.default.range(0, nbOfNoneUtterances).map(() => {
    const nbWords = Math.round(_lodash.default.random(1, avgTokens * 2, false));
    return _lodash.default.sampleSize(junkWords, nbWords).join(joinChar);
  });

  const mixedUtts = _lodash.default.range(0, nbOfNoneUtterances).map(() => {
    const nbWords = Math.round(_lodash.default.random(1, avgTokens * 2, false));
    return _lodash.default.sampleSize([...junkWords, ...stopWords], nbWords).join(joinChar);
  });

  const intent = {
    name: NONE_INTENT,
    slot_definitions: [],
    utterances: await (0, _utterance.buildUtteranceBatch)([...mixedUtts, ...vocabUtts, ...junkWordsUtts, ...stopWords], input.languageCode, tools),
    contexts: [...input.contexts],
    vocab: {},
    slot_entities: []
  };
  return { ...input,
    intents: [...input.intents, intent]
  };
};

exports.AppendNoneIntent = AppendNoneIntent;

const TfidfTokens = async input => {
  const tfidfInput = input.intents.reduce((tfidfInput, intent) => ({ ...tfidfInput,
    [intent.name]: _lodash.default.flatMapDeep(intent.utterances.map(u => u.tokens.map(t => t.toString({
      lowerCase: true
    }))))
  }), {});
  const {
    __avg__: avg_tfidf
  } = (0, _tfidf.default)(tfidfInput);
  const copy = { ...input,
    tfIdf: avg_tfidf
  };
  copy.intents.forEach(x => x.utterances.forEach(u => u.setGlobalTfidf(avg_tfidf)));
  return copy;
};

exports.TfidfTokens = TfidfTokens;

const TrainSlotTagger = async (input, tools, progress) => {
  const hasSlots = _lodash.default.flatMap(input.intents, i => i.slot_definitions).length > 0;

  if (!hasSlots) {
    progress();
    return Buffer.from('');
  }

  debugTraining.forBot(input.botId, 'Training slot tagger');
  const slotTagger = new _slotTagger.default(tools.mlToolkit);
  await slotTagger.train(input.intents.filter(i => i.name !== NONE_INTENT));
  debugTraining.forBot(input.botId, 'Done training slot tagger');
  progress();
  return slotTagger.serialized;
};

const TrainOutOfScope = async (input, tools, progress) => {
  debugTraining.forBot(input.botId, 'Training out of scope classifier');
  const trainingOptions = {
    c: [10],
    gamma: [0.1],
    kernel: 'LINEAR',
    classifier: 'C_SVC',
    reduce: false
  };

  const noneUtts = _lodash.default.chain(input.intents).filter(i => i.name === NONE_INTENT).flatMap(i => i.utterances).value();

  if (!(0, _posTagger.isPOSAvailable)(input.languageCode) || noneUtts.length === 0) {
    progress();
    return;
  }

  const oos_points = (0, _outOfScopeFeaturizer.featurizeOOSUtterances)(noneUtts, tools);

  const in_scope_points = _lodash.default.chain(input.intents).filter(i => i.name !== NONE_INTENT).flatMap(i => (0, _outOfScopeFeaturizer.featurizeInScopeUtterances)(i.utterances, i.name)).value();

  const svm = new tools.mlToolkit.SVM.Trainer();
  const model = await svm.train([...in_scope_points, ...oos_points], trainingOptions, p => {
    progress(_lodash.default.round(p, 2));
  });
  debugTraining.forBot(input.botId, 'Done training out of scope');
  return model;
};

const NB_STEPS = 5; // change this if the training pipeline changes

const Trainer = async (input, tools) => {
  const model = {
    startedAt: new Date(),
    languageCode: input.languageCode,
    data: {
      input
    }
  };
  let totalProgress = 0;
  let normalizedProgress = 0;

  const debouncedProgress = _lodash.default.debounce(tools.reportTrainingProgress, 75, {
    maxWait: 750
  });

  const reportProgress = (stepProgress = 1) => {
    if (!input.trainingSession) {
      return;
    }

    if (input.trainingSession.status === 'canceled') {
      // Note that we don't use debouncedProgress here as we want the side effects probagated now
      tools.reportTrainingProgress(input.botId, 'Training canceled', input.trainingSession);
      throw new TrainingCanceledError();
    }

    totalProgress = Math.max(totalProgress, Math.floor(totalProgress) + _lodash.default.round(stepProgress, 2));
    const scaledProgress = Math.min(1, _lodash.default.round(totalProgress / NB_STEPS, 2));

    if (scaledProgress === normalizedProgress) {
      return;
    }

    normalizedProgress = scaledProgress;
    debouncedProgress(input.botId, 'Training', { ...input.trainingSession,
      progress: normalizedProgress
    });
  };

  try {
    let output = await PreprocessInput(input, tools);
    output = await TfidfTokens(output);
    output = ClusterTokens(output, tools);
    output = await ExtractEntities(output, tools);
    output = await AppendNoneIntent(output, tools);
    const exact_match_index = BuildExactMatchIndex(output);
    reportProgress();
    const [oos_model, ctx_model, intent_model_by_ctx, slots_model] = await Promise.all([TrainOutOfScope(output, tools, reportProgress), TrainContextClassifier(output, tools, reportProgress), TrainIntentClassifier(output, tools, reportProgress), TrainSlotTagger(output, tools, reportProgress)]);
    const artefacts = {
      list_entities: output.list_entities,
      oos_model,
      tfidf: output.tfIdf,
      ctx_model,
      intent_model_by_ctx,
      slots_model,
      vocabVectors: buildVectorsVocab(output.intents),
      exact_match_index // kmeans: {} add this when mlKmeans supports loading from serialized data,

    };

    _lodash.default.merge(model, {
      success: true,
      data: {
        artefacts,
        output
      }
    });
  } catch (err) {
    if (err instanceof TrainingCanceledError) {
      debugTraining.forBot(input.botId, 'Training aborted');
    } else {
      // TODO use bp.logger once this is moved in Engine2
      console.log('Could not finish training NLU model', err);
    }

    model.success = false;
  } finally {
    model.finishedAt = new Date();
    return model;
  }
};

exports.Trainer = Trainer;

class TrainingCanceledError extends Error {
  constructor() {
    super('Training cancelled');
    this.name = 'CancelError';
  }

}
//# sourceMappingURL=training-pipeline.js.map