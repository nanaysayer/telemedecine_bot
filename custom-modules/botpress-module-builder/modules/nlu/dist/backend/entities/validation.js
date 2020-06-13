"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EntityDefCreateSchema = exports.FuzzyTolerance = void 0;

var _joi = _interopRequireDefault(require("joi"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const FuzzyTolerance = {
  Loose: 0.65,
  Medium: 0.8,
  Strict: 1
};
exports.FuzzyTolerance = FuzzyTolerance;

const EntityDefOccurrenceSchema = _joi.default.object().keys({
  name: _joi.default.string().required(),
  synonyms: _joi.default.array().items(_joi.default.string())
});

const EntityDefCreateSchema = _joi.default.object().keys({
  id: _joi.default.string().regex(/\t\s/gi, {
    invert: true
  }),
  name: _joi.default.string().required(),
  type: _joi.default.string().valid(['system', 'pattern', 'list']).required(),
  sensitive: _joi.default.boolean().default(false),
  fuzzy: _joi.default.number().default(FuzzyTolerance.Medium),
  matchCase: _joi.default.boolean(),
  examples: _joi.default.array().items(_joi.default.string()).default([]),
  occurrences: _joi.default.array().items(EntityDefOccurrenceSchema).default([]),
  pattern: _joi.default.string().default('').allow('')
});

exports.EntityDefCreateSchema = EntityDefCreateSchema;
//# sourceMappingURL=validation.js.map