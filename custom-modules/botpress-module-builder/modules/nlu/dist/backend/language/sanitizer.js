"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.sanitize = void 0;

const StripSpecialChars = txt => txt.replace(/[&\/\\#,+()$!^~%.'":*?<>{}\u2581]/g, '').trim();

const sanitize = text => {
  return StripSpecialChars(text);
};

exports.sanitize = sanitize;
//# sourceMappingURL=sanitizer.js.map