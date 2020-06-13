"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.IntentDefCreateSchema = exports.SlotsCreateSchema = void 0;

var _joi = _interopRequireDefault(require("joi"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const SlotsCreateSchema = _joi.default.object().keys({
  name: _joi.default.string().required(),
  entities: _joi.default.array().items(_joi.default.string()).required(),
  color: _joi.default.number().required(),
  id: _joi.default.string().required()
});

exports.SlotsCreateSchema = SlotsCreateSchema;

const IntentDefCreateSchema = _joi.default.object().keys({
  name: _joi.default.string().required(),
  utterances: _joi.default.object().pattern(/.*/, _joi.default.array().items(_joi.default.string())).default({}),
  slots: _joi.default.array().items(SlotsCreateSchema).default([]),
  contexts: _joi.default.array().items(_joi.default.string()).default(['global'])
});

exports.IntentDefCreateSchema = IntentDefCreateSchema;
//# sourceMappingURL=validation.js.map