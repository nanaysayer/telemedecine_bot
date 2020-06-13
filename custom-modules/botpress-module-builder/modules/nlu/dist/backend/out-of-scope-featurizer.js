"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getUtteranceFeatures = getUtteranceFeatures;
exports.featurizeOOSUtterances = featurizeOOSUtterances;
exports.featurizeInScopeUtterances = featurizeInScopeUtterances;

var _math = require("./tools/math");

const POS1_SET = ['VERB', 'NOUN'];
const POS2_SET = ['DET', 'PROPN', 'PRON', 'ADJ', 'AUX'];
const POS3_SET = ['CONJ', 'CCONJ', 'INTJ', 'SCONJ', 'ADV'];
const K_CLUSTERS = 3;
const KMEANS_OPTIONS = {
  iterations: 250,
  initialization: 'random',
  seed: 666 // so training is consistent

};

function averageByPOS(utt, posClasses) {
  const tokens = utt.tokens.filter(t => posClasses.includes(t.POS));
  const vectors = tokens.map(x => (0, _math.scalarMultiply)(x.vector, x.tfidf));

  if (!vectors.length) {
    return (0, _math.zeroes)(utt.tokens[0].vector.length);
  }

  return (0, _math.averageVectors)(vectors);
}

function getUtteranceFeatures(utt) {
  const pos1 = averageByPOS(utt, POS1_SET);
  const pos2 = averageByPOS(utt, POS2_SET);
  const pos3 = averageByPOS(utt, POS3_SET); // maybe add % of tokens in vocab as feature

  const feats = [...pos1, ...pos2, ...pos3, utt.tokens.length];
  return feats;
}

function featurizeOOSUtterances(utts, tools) {
  const noneEmbeddings = utts.map(getUtteranceFeatures);
  const kmeans = tools.mlToolkit.KMeans.kmeans(noneEmbeddings, K_CLUSTERS, KMEANS_OPTIONS);
  return noneEmbeddings.map(emb => ({
    label: `out_${kmeans.nearest([emb])[0]}`,
    coordinates: emb
  }));
}

function featurizeInScopeUtterances(utts, intentName) {
  return utts.map(utt => ({
    label: intentName,
    coordinates: getUtteranceFeatures(utt)
  }));
}
//# sourceMappingURL=out-of-scope-featurizer.js.map