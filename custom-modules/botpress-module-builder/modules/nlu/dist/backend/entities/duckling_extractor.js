"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DucklingEntityExtractor = exports.JOIN_CHAR = void 0;

var _axios = _interopRequireDefault(require("axios"));

var _bluebirdRetry = _interopRequireDefault(require("bluebird-retry"));

var _fsExtra = require("fs-extra");

var _httpsProxyAgent = _interopRequireDefault(require("https-proxy-agent"));

var _lodash = _interopRequireDefault(require("lodash"));

var _lruCache = _interopRequireDefault(require("lru-cache"));

var _ms = _interopRequireDefault(require("ms"));

var _objectSizeof = _interopRequireDefault(require("object-sizeof"));

var _path = _interopRequireDefault(require("path"));

var _patternsUtils = require("../tools/patterns-utils");

var _tokenUtils = require("../tools/token-utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const JOIN_CHAR = `::${_tokenUtils.SPACE}::`;
exports.JOIN_CHAR = JOIN_CHAR;
const BATCH_SIZE = 10;
const DISABLED_MSG = `, so it will be disabled.
For more information (or if you want to self-host it), please check the docs at
https://botpress.com/docs/build/nlu/#system-entities
`;
const DUCKLING_ENTITIES = ['amountOfMoney', 'distance', 'duration', 'email', 'number', 'ordinal', 'phoneNumber', 'quantity', 'temperature', 'time', 'url', 'volume'];
const RETRY_POLICY = {
  backoff: 2,
  max_tries: 3,
  timeout: 500
};

const CACHE_PATH = _path.default.join(process.APP_DATA_PATH || '', 'cache', 'sys_entities.json'); // Further improvements:
// 1 - Duckling entity interface
// 3- in _extractBatch, shift results ==> don't walk whole array n times (nlog(n) vs n2)


class DucklingEntityExtractor {
  constructor(logger) {
    this.logger = logger;

    _defineProperty(this, "_cacheDumpEnabled", true);

    _defineProperty(this, "_onCacheChanged", _lodash.default.debounce(async () => {
      if (this._cacheDumpEnabled) {
        await this._dumpCache();
      }
    }, (0, _ms.default)('10s')));
  }

  static get entityTypes() {
    return DucklingEntityExtractor.enabled ? DUCKLING_ENTITIES : [];
  }

  static async configure(enabled, url, logger) {
    if (enabled) {
      const proxyConfig = process.PROXY ? {
        httpsAgent: new _httpsProxyAgent.default(process.PROXY)
      } : {};
      this.client = _axios.default.create({
        baseURL: url,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        ...proxyConfig
      });

      try {
        await (0, _bluebirdRetry.default)(async () => {
          const {
            data
          } = await this.client.get('/');

          if (data !== 'quack!') {
            return logger && logger.warn(`Bad response from Duckling server ${DISABLED_MSG}`);
          }

          this.enabled = true;
        }, RETRY_POLICY);
      } catch (err) {
        logger && logger.attachError(err).warn(`Couldn't reach the Duckling server ${DISABLED_MSG}`);
      }

      this._cache = new _lruCache.default({
        length: (val, key) => (0, _objectSizeof.default)(val) + (0, _objectSizeof.default)(key),
        max: 1000 * // n bytes per entity
        2 * // entities per utterance
        10 * // n utterances per intent
        100 * // n intents per bot
        50 // n bots
        // ~ 100 mb

      });
      await this._restoreCache();
    }
  }

  static async _restoreCache() {
    try {
      if (await (0, _fsExtra.pathExists)(CACHE_PATH)) {
        const dump = await (0, _fsExtra.readJSON)(CACHE_PATH);

        if (dump) {
          this._cache.load(dump);
        }
      }
    } catch (err) {
      console.log('could not load duckling cache');
    }
  }

  async extractMultiple(inputs, lang, useCache) {
    if (!DucklingEntityExtractor.enabled) {
      return Array(inputs.length).fill([]);
    }

    const options = {
      lang,
      tz: this._getTz(),
      refTime: Date.now()
    };
    const [cached, toFetch] = inputs.reduce(([cached, toFetch], input, idx) => {
      if (useCache && DucklingEntityExtractor._cache.has(input)) {
        const entities = DucklingEntityExtractor._cache.get(input);

        return [[...cached, {
          input,
          idx,
          entities
        }], toFetch];
      } else {
        return [cached, [...toFetch, {
          input,
          idx
        }]];
      }
    }, [[], []]);

    const chunks = _lodash.default.chunk(toFetch, BATCH_SIZE);

    const batchedRes = await Promise.mapSeries(chunks, c => this._extractBatch(c, options));
    return _lodash.default.chain(batchedRes).flatten().concat(cached).orderBy('idx').map('entities').value();
  }

  async extract(input, lang, useCache) {
    return (await this.extractMultiple([input], lang, useCache))[0];
  }

  async _dumpCache() {
    try {
      await (0, _fsExtra.ensureFile)(CACHE_PATH);
      await (0, _fsExtra.writeJson)(CACHE_PATH, DucklingEntityExtractor._cache.dump());
    } catch (err) {
      this.logger.error('could not persist system entities cache, error' + err.message);
      this._cacheDumpEnabled = false;
    }
  }

  async _extractBatch(batch, params) {
    if (_lodash.default.isEmpty(batch)) {
      return [];
    } // trailing JOIN_CHAR so we have n joints and n examples


    const strBatch = batch.map(x => x.input);
    const concatBatch = strBatch.join(JOIN_CHAR) + JOIN_CHAR;
    const batchEntities = await this._fetchDuckling(concatBatch, params);
    const splitLocations = (0, _patternsUtils.extractPattern)(concatBatch, new RegExp(JOIN_CHAR)).map(v => v.sourceIndex);
    const entities = splitLocations.map((to, idx, locs) => {
      const from = idx === 0 ? 0 : locs[idx - 1] + JOIN_CHAR.length;
      return batchEntities.filter(e => e.start >= from && e.end <= to).map(e => ({ ...e,
        start: e.start - from,
        end: e.end - from
      }));
    });
    await this._cacheBatchResults(strBatch, entities);
    return batch.map((batchItm, i) => ({ ...batchItm,
      entities: entities[i]
    }));
  }

  async _fetchDuckling(text, {
    lang,
    tz,
    refTime
  }) {
    try {
      return await (0, _bluebirdRetry.default)(async () => {
        const {
          data
        } = await DucklingEntityExtractor.client.post('/parse', `lang=${lang}&text=${text}&reftime=${refTime}&tz=${tz}`);

        if (!_lodash.default.isArray(data)) {
          throw new Error('Unexpected response from Duckling. Expected an array.');
        }

        return data.map(this._mapDuckToEntity.bind(this));
      }, RETRY_POLICY);
    } catch (err) {
      const error = err.response ? err.response.data : err;
      this.logger && this.logger.attachError(error).warn('Error extracting duckling entities');
      return [];
    }
  }

  async _cacheBatchResults(inputs, results) {
    _lodash.default.zip(inputs, results).forEach(([input, entities]) => {
      DucklingEntityExtractor._cache.set(input, entities);
    });

    await this._onCacheChanged();
  }

  _getTz() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  _mapDuckToEntity(duckEnt) {
    const dimensionData = this._getUnitAndValue(duckEnt.dim, duckEnt.value);

    return {
      confidence: 1,
      start: duckEnt.start,
      end: duckEnt.end,
      type: duckEnt.dim,
      value: dimensionData.value,
      metadata: {
        extractor: 'system',
        source: duckEnt.body,
        entityId: `system.${duckEnt.dim}`,
        unit: dimensionData.unit
      }
    };
  }

  _getUnitAndValue(dimension, rawVal) {
    switch (dimension) {
      case 'duration':
        return rawVal.normalized;

      case 'time':
        return {
          value: rawVal.value,
          unit: rawVal.grain
        };

      default:
        return {
          value: rawVal.value,
          unit: rawVal.unit
        };
    }
  }

}

exports.DucklingEntityExtractor = DucklingEntityExtractor;

_defineProperty(DucklingEntityExtractor, "enabled", void 0);

_defineProperty(DucklingEntityExtractor, "client", void 0);

_defineProperty(DucklingEntityExtractor, "_cache", void 0);
//# sourceMappingURL=duckling_extractor.js.map