"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getStopWordsForLang = getStopWordsForLang;

var _fs = require("fs");

var _fsExtra = _interopRequireDefault(require("fs-extra"));

var _path = _interopRequireDefault(require("path"));

var _readline = _interopRequireDefault(require("readline"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const StopWordsByLang = {};

async function loadStopWords(language) {
  const filePath = _path.default.join(__dirname, `stop-words/${language}.txt`);

  if (!(await _fsExtra.default.pathExists(filePath))) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const stopWords = [];
    const stream = (0, _fs.createReadStream)(filePath);

    const rl = _readline.default.createInterface({
      input: stream,
      crlfDelay: Infinity
    });

    rl.on('line', l => {
      stopWords.push(l);
    });
    rl.on('close', () => resolve(stopWords));
  });
}

async function getStopWordsForLang(language) {
  if (!StopWordsByLang[language]) {
    StopWordsByLang[language] = await loadStopWords(language);
  }

  return StopWordsByLang[language];
}
//# sourceMappingURL=stopWords.js.map