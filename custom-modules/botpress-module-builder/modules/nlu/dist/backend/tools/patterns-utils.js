"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isPatternValid = isPatternValid;
exports.extractPattern = extractPattern;

function isPatternValid(pattern) {
  try {
    new RegExp(pattern);
    return pattern !== '';
  } catch (e) {
    return false;
  }
} // Padding is necessary due to the recursive nature of this function.
// Every found pattern is removed from the candidate, therefor the length of the extracted value (padding) is needed to compute sourceIndex of future extractions


function extractPattern(candidate, pattern, extracted = [], padding = 0) {
  const res = pattern.exec(candidate);

  if (!res) {
    return extracted;
  }

  const value = res[0];
  const nextPadding = padding + value.length;
  const nextCandidate = candidate.slice(0, res.index) + candidate.slice(res.index + value.length);
  extracted.push({
    value,
    sourceIndex: res.index + padding
  });
  return extractPattern(nextCandidate, pattern, extracted, nextPadding);
}
//# sourceMappingURL=patterns-utils.js.map