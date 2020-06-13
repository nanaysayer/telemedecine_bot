"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ndistance = ndistance;
exports.GetZPercent = GetZPercent;
exports.computeNorm = computeNorm;
exports.vectorAdd = vectorAdd;
exports.scalarMultiply = scalarMultiply;
exports.averageVectors = averageVectors;
exports.scalarDivide = scalarDivide;
exports.allInRange = allInRange;
exports.zeroes = zeroes;
exports.computeQuantile = computeQuantile;
exports.relativeStd = relativeStd;
Object.defineProperty(exports, "log", {
  enumerable: true,
  get: function () {
    return _mathjs.log;
  }
});
Object.defineProperty(exports, "std", {
  enumerable: true,
  get: function () {
    return _mathjs.std;
  }
});
Object.defineProperty(exports, "mean", {
  enumerable: true,
  get: function () {
    return _mathjs.mean;
  }
});

var _lodash = _interopRequireDefault(require("lodash"));

var _mathjs = require("mathjs");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Vectorial distance between two N-dimentional points
 * a[] and b[] must be of same dimention
 */
function ndistance(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Can't calculate distance between vectors of different length (${a.length} vs ${b.length})`);
  }

  let total = 0;

  for (let i = 0; i < a.length; i++) {
    const diff = b[i] - a[i];
    total += diff * diff;
  }

  return Math.sqrt(total);
}

function GetZPercent(z) {
  if (z < -6.5) {
    return 0.0;
  }

  if (z > 6.5) {
    return 1.0;
  }

  let factK = 1;
  let sum = 0;
  let term = 1;
  let k = 0;
  const loopStop = Math.exp(-23);

  while (Math.abs(term) > loopStop) {
    term = 0.3989422804 * Math.pow(-1, k) * Math.pow(z, k) / (2 * k + 1) / Math.pow(2, k) * Math.pow(z, k + 1) / factK;
    sum += term;
    k++;
    factK *= k;
  }

  sum += 0.5;
  return sum;
}

function computeNorm(vec) {
  return Math.sqrt(vec.reduce((acc, next) => acc + Math.pow(next, 2), 0));
}

function add(...args) {
  return args.reduce(_lodash.default.add, 0);
}

function vectorAdd(...args) {
  for (const vec of args) {
    if (vec.length !== args[0].length) {
      throw new Error('dimensions should match');
    }
  }

  return _lodash.default.zipWith(...args, add);
}

function scalarMultiply(vec, multiplier) {
  return vec.map(x => x * multiplier);
}

function averageVectors(vecs) {
  if (!vecs.length) {
    return [];
  }

  if (_lodash.default.uniqBy(vecs, 'length').length > 1) {
    throw new Error('Vectors must all be of the same size');
  }

  const normalized = vecs.map(vec => {
    const norm = computeNorm(vec);

    if (norm) {
      return scalarDivide(vec, norm);
    }
  }).filter(Boolean);
  return vectorAdd(...normalized);
}

function scalarDivide(vec, divider) {
  return scalarMultiply(vec, 1 / divider);
}

function allInRange(vec, lower, upper) {
  return vec.map(v => _lodash.default.inRange(v, lower, upper)).every(_lodash.default.identity);
}

function zeroes(len) {
  return Array(len).fill(0);
}
/**
 * @param quantile number of discret categories ex: 4 == quartile
 * @param target value to classify
 * @param upperBound maximum value the target can take
 * @param lowerBound minimum value the target can take
 * @returns integer value between [1, quantile]
 */


function computeQuantile(quantile, target, upperBound, lowerBound = 0) {
  return Math.min(quantile, Math.max(Math.ceil(quantile * ((target - lowerBound) / (upperBound - lowerBound))), 1));
}
/**
 * @returns relative standard dev
 */


function relativeStd(vec) {
  return (0, _mathjs.std)(vec) / (0, _mathjs.mean)(vec);
}
//# sourceMappingURL=math.js.map