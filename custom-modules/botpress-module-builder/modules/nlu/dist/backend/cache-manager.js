"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getOrCreateCache = getOrCreateCache;
exports.deleteCache = deleteCache;
exports.copyCache = copyCache;
exports.loadCacheFromData = loadCacheFromData;
exports.isCacheDump = isCacheDump;

var _lodash = _interopRequireDefault(require("lodash"));

var _lruCache = _interopRequireDefault(require("lru-cache"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const cacheMap = {};

function getCacheId(name, prefix = '') {
  return `${prefix}.${name}`;
}

function getOrCreateCache(name, botId, options) {
  const cacheId = getCacheId(name, botId);

  if (!cacheMap[cacheId]) {
    // @ts-ignore
    cacheMap[cacheId] = new _lruCache.default(options || 1000);
  }

  return cacheMap[cacheId];
}

function deleteCache(name, botId) {
  var _cacheMap$cacheId;

  const cacheId = getCacheId(name, botId);
  (_cacheMap$cacheId = cacheMap[cacheId]) === null || _cacheMap$cacheId === void 0 ? void 0 : _cacheMap$cacheId.reset();
  delete cacheMap[cacheId];
}

function copyCache(currentName, newName, botId) {
  const currentCacheId = getCacheId(currentName, botId);
  const targetCacheId = getCacheId(newName, botId);
  cacheMap[targetCacheId] = _lodash.default.clone(cacheMap[currentCacheId]);
}

function loadCacheFromData(data, name, botId) {
  const cache = getOrCreateCache(name, botId);

  if (cache.length === 0) {
    cache.load(data);
  }

  return cache;
} // if necessary implement loadCacheFromPath


function isCacheDump(data) {
  return !(typeof (data === null || data === void 0 ? void 0 : data.has) === 'function');
}
//# sourceMappingURL=cache-manager.js.map