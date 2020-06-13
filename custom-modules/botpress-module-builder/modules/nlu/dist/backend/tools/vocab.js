"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getClosestToken = getClosestToken;

var _lodash = _interopRequireDefault(require("lodash"));

var _math = require("./math");

var _strings = require("./strings");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getMaxLevOps(token, candidateTok) {
  const longestLength = Math.max(token.length, candidateTok.length);

  if (longestLength <= 3) {
    return 0;
  } else if (longestLength <= 4) {
    return 1;
  } else if (longestLength < 10) {
    return 2;
  } else {
    return 3;
  }
}

function getClosestToken(tokenStr, tokenVec, token2Vec, useSpacial = false) {
  let closestTok = '';
  let dist = Number.POSITIVE_INFINITY;

  _lodash.default.forEach(token2Vec, (candidateVec, candidateTok) => {
    // Leveinshtein is for typo detection
    const lev = (0, _strings.damerauLevenshtein)(tokenStr, candidateTok);
    const maxLevOps = getMaxLevOps(tokenStr, candidateTok);

    if (lev <= maxLevOps && lev < dist) {
      dist = lev;
      closestTok = candidateTok;
    } // Space (vector) distance is for close-meaning detection


    const d = useSpacial ? (0, _math.ndistance)(tokenVec, candidateVec) : Number.POSITIVE_INFINITY; // stricly smaller, we want letter distance to take precedence over spacial

    if (d < dist) {
      closestTok = candidateTok;
      dist = d;
    }
  });

  return closestTok;
}
//# sourceMappingURL=vocab.js.map