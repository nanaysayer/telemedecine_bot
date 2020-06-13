"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.FastTextLanguageId = exports.NA_LANG = void 0;

var _fs = require("fs");

var _path = require("path");

var _tmp = _interopRequireDefault(require("tmp"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const PRETRAINED_LID_176 = (0, _path.join)(__dirname, './pre-trained/lid.176.ftz');
const NA_LANG = 'n/a';
exports.NA_LANG = NA_LANG;

class FastTextLanguageId {
  constructor(toolkit) {
    FastTextLanguageId.toolkit = toolkit;
  }

  static async initializeModel() {
    const tmpFn = _tmp.default.tmpNameSync({
      postfix: '.ftz'
    });

    const modelBuff = (0, _fs.readFileSync)(PRETRAINED_LID_176);
    (0, _fs.writeFileSync)(tmpFn, modelBuff);
    const ft = new FastTextLanguageId.toolkit.FastText.Model();
    await ft.loadFromFile(tmpFn);
    FastTextLanguageId.model = ft;
  }

  async identify(text) {
    if (!FastTextLanguageId.model) {
      await FastTextLanguageId.initializeModel();
    }

    if (!FastTextLanguageId.model) {
      return [];
    }

    return (await FastTextLanguageId.model.predict(text, 3)).map(pred => ({ ...pred,
      label: pred.label.replace('__label__', '')
    })).sort((predA, predB) => predB.value - predA.value); // descending
  }

}

exports.FastTextLanguageId = FastTextLanguageId;

_defineProperty(FastTextLanguageId, "model", void 0);

_defineProperty(FastTextLanguageId, "toolkit", void 0);

class LanguageIdentifierProvider {
  static getLanguageIdentifier(toolkit) {
    if (!LanguageIdentifierProvider.__instance) {
      LanguageIdentifierProvider.__instance = new FastTextLanguageId(toolkit);
    }

    return LanguageIdentifierProvider.__instance;
  }

}

exports.default = LanguageIdentifierProvider;

_defineProperty(LanguageIdentifierProvider, "__instance", void 0);
//# sourceMappingURL=language-identifier.js.map