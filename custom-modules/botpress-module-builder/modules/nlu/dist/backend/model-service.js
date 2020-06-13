"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.computeModelHash = computeModelHash;
exports.pruneModels = pruneModels;
exports.listModelsForLang = listModelsForLang;
exports.getModel = getModel;
exports.getLatestModel = getLatestModel;
exports.saveModel = saveModel;
exports.MODELS_DIR = void 0;

var _crypto = _interopRequireDefault(require("crypto"));

var _fsExtra = _interopRequireDefault(require("fs-extra"));

var _lodash = _interopRequireDefault(require("lodash"));

var _path = _interopRequireDefault(require("path"));

var _stream = require("stream");

var _tar = _interopRequireDefault(require("tar"));

var _tmp = _interopRequireDefault(require("tmp"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const MODELS_DIR = './models';
exports.MODELS_DIR = MODELS_DIR;
const MAX_MODELS_TO_KEEP = 2;

function makeFileName(hash, lang) {
  return `${hash}.${lang}.model`;
} // we might want to make this language specific


function computeModelHash(intents, entities) {
  return _crypto.default.createHash('md5').update(JSON.stringify({
    intents,
    entities
  })).digest('hex');
}

function serializeModel(ref) {
  const model = _lodash.default.cloneDeep(ref);

  for (const entity of model.data.artefacts.list_entities) {
    var _ref, _ref2;

    entity.cache = (_ref = (_ref2 = entity.cache) === null || _ref2 === void 0 ? void 0 : _ref2.dump()) !== null && _ref !== void 0 ? _ref : [];
  }

  return JSON.stringify(_lodash.default.omit(model, ['data.output', 'data.input.trainingSession']));
}

function deserializeModel(str) {
  const model = JSON.parse(str);
  model.data.artefacts.slots_model = Buffer.from(model.data.artefacts.slots_model);
  return model;
}

async function pruneModels(ghost, languageCode) {
  const models = await listModelsForLang(ghost, languageCode);

  if (models.length > MAX_MODELS_TO_KEEP) {
    return Promise.map(models.slice(MAX_MODELS_TO_KEEP), file => ghost.deleteFile(MODELS_DIR, file));
  }
}

async function listModelsForLang(ghost, languageCode) {
  const endingPattern = makeFileName('*', languageCode);
  return await ghost.directoryListing(MODELS_DIR, endingPattern, undefined, undefined, {
    sortOrder: {
      column: 'modifiedOn',
      desc: true
    }
  });
}

async function getModel(ghost, hash, lang) {
  const fname = makeFileName(hash, lang);

  if (!(await ghost.fileExists(MODELS_DIR, fname))) {
    return;
  }

  const buffStream = new _stream.Stream.PassThrough();
  buffStream.end((await ghost.readFileAsBuffer(MODELS_DIR, fname)));

  const tmpDir = _tmp.default.dirSync({
    unsafeCleanup: true
  });

  const tarStream = _tar.default.x({
    cwd: tmpDir.name,
    strict: true
  }, ['model']);

  buffStream.pipe(tarStream);
  await new Promise(resolve => tarStream.on('close', resolve));
  const modelBuff = await _fsExtra.default.readFile(_path.default.join(tmpDir.name, 'model'));
  let mod;

  try {
    mod = deserializeModel(modelBuff.toString());
  } catch (err) {
    await ghost.deleteFile(MODELS_DIR, fname);
  } finally {
    tmpDir.removeCallback();
    return mod;
  }
}

async function getLatestModel(ghost, lang) {
  const availableModels = await listModelsForLang(ghost, lang);

  if (availableModels.length === 0) {
    return;
  }

  return getModel(ghost, availableModels[0].split('.')[0], lang);
}

async function saveModel(ghost, model, hash) {
  const serialized = serializeModel(model);
  const modelName = makeFileName(hash, model.languageCode);

  const tmpDir = _tmp.default.dirSync({
    unsafeCleanup: true
  });

  const tmpFileName = _path.default.join(tmpDir.name, 'model');

  await _fsExtra.default.writeFile(tmpFileName, serialized);

  const archiveName = _path.default.join(tmpDir.name, modelName);

  await _tar.default.create({
    file: archiveName,
    cwd: tmpDir.name,
    portable: true,
    gzip: true
  }, ['model']);
  const buffer = await _fsExtra.default.readFile(archiveName);
  await ghost.upsertFile(MODELS_DIR, modelName, buffer);
  tmpDir.removeCallback();
  return pruneModels(ghost, model.languageCode);
}
//# sourceMappingURL=model-service.js.map