"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.RemoteLanguageProvider = void 0;

var _axios = _interopRequireDefault(require("axios"));

var _bluebirdRetry = _interopRequireDefault(require("bluebird-retry"));

var _fsExtra = _interopRequireDefault(require("fs-extra"));

var _httpsProxyAgent = _interopRequireDefault(require("https-proxy-agent"));

var _lodash = _interopRequireWildcard(require("lodash"));

var _lruCache = _interopRequireDefault(require("lru-cache"));

var _moment = _interopRequireDefault(require("moment"));

var _ms = _interopRequireDefault(require("ms"));

var _path = _interopRequireDefault(require("path"));

var _strings = require("../tools/strings");

var _tokenUtils = require("../tools/token-utils");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const debug = DEBUG('nlu').sub('lang');
const MAX_PAYLOAD_SIZE = 150 * 1024; // 150kb

const JUNK_VOCAB_SIZE = 500;
const JUNK_TOKEN_MIN = 1;
const JUNK_TOKEN_MAX = 20;

class RemoteLanguageProvider {
  constructor() {
    _defineProperty(this, "_vectorsCachePath", _path.default.join(process.APP_DATA_PATH, 'cache', 'lang_vectors.json'));

    _defineProperty(this, "_junkwordsCachePath", _path.default.join(process.APP_DATA_PATH, 'cache', 'junk_words.json'));

    _defineProperty(this, "_tokensCachePath", _path.default.join(process.APP_DATA_PATH, 'cache', 'utterance_tokens.json'));

    _defineProperty(this, "_vectorsCache", void 0);

    _defineProperty(this, "_tokensCache", void 0);

    _defineProperty(this, "_junkwordsCache", void 0);

    _defineProperty(this, "_cacheDumpDisabled", false);

    _defineProperty(this, "_validProvidersCount", void 0);

    _defineProperty(this, "_languageDims", void 0);

    _defineProperty(this, "discoveryRetryPolicy", {
      interval: 1000,
      max_interval: 5000,
      timeout: 2000,
      max_tries: 5
    });

    _defineProperty(this, "langs", {});

    _defineProperty(this, "handleLanguageServerError", (err, endpoint, logger) => {
      const status = _lodash.default.get(err, 'failure.response.status');

      const details = _lodash.default.get(err, 'failure.response.message');

      if (status === 429) {
        logger.error(`Could not load Language Server: ${details}. You may be over the limit for the number of requests allowed for the endpoint ${endpoint}`);
      } else if (status === 401) {
        logger.error(`You must provide a valid authentication token for the endpoint ${endpoint}`);
      } else {
        logger.attachError(err).error(`Could not load Language Provider at ${endpoint}: ${err.code}`);
      }
    });

    _defineProperty(this, "onTokensCacheChanged", (0, _lodash.debounce)(async () => {
      if (!this._cacheDumpDisabled) {
        await this.dumpTokensCache();
      }
    }, (0, _ms.default)('5s')));

    _defineProperty(this, "onVectorsCacheChanged", (0, _lodash.debounce)(async () => {
      if (!this._cacheDumpDisabled) {
        await this.dumpVectorsCache();
      }
    }, (0, _ms.default)('5s')));

    _defineProperty(this, "onJunkWordsCacheChanged", (0, _lodash.debounce)(async () => {
      if (!this._cacheDumpDisabled) {
        await this.dumpJunkWordsCache();
      }
    }, (0, _ms.default)('5s')));
  }

  get languages() {
    return Object.keys(this.langs);
  }

  addProvider(lang, source, client) {
    this.langs[lang] = [...(this.langs[lang] || []), {
      source,
      client,
      errors: 0,
      disabledUntil: undefined
    }];
    debug(`[${lang.toUpperCase()}] Language Provider added %o`, source);
  }

  async initialize(sources, logger) {
    this._validProvidersCount = 0;
    this._vectorsCache = new _lruCache.default({
      length: arr => {
        if (arr && arr.BYTES_PER_ELEMENT) {
          return arr.length * arr.BYTES_PER_ELEMENT;
        } else {
          return 300
          /* dim */
          * Float32Array.BYTES_PER_ELEMENT;
        }
      },
      max: 300
      /* dim */
      * Float32Array.BYTES_PER_ELEMENT
      /* bytes */
      * 500000
      /* tokens */

    });
    this._tokensCache = new _lruCache.default({
      length: (val, key) => key.length * 4 + (0, _lodash.sumBy)(val, x => x.length * 4),
      max: 4 * // bytes in strings
      5 * // average size of token
      10 * // nb of tokens per utterance
      10 * // nb of utterances per intent
      200 * // nb of intents per model
      10 * // nb of models per bot
      50 // nb of bots
      // total is ~ 200 mb

    });
    this._junkwordsCache = new _lruCache.default({
      length: (val, key) => (0, _lodash.sumBy)(key, x => x.length * 4) + (0, _lodash.sumBy)(val, x => x.length * 4),
      max: 4 * // bytes in strings
      10 * // token size
      500 * // vocab size
      1000 * // junk words
      10 // models
      // total is ~ 200 mb

    });
    await Promise.mapSeries(sources, async source => {
      const headers = {};

      if (source.authToken) {
        headers['authorization'] = 'bearer ' + source.authToken;
      }

      const proxyConfig = process.PROXY ? {
        httpsAgent: new _httpsProxyAgent.default(process.PROXY)
      } : {};

      const client = _axios.default.create({
        baseURL: source.endpoint,
        headers,
        ...proxyConfig
      });

      try {
        await (0, _bluebirdRetry.default)(async () => {
          const {
            data
          } = await client.get('/info');

          if (!data.ready) {
            throw new Error('Language source is not ready');
          }

          if (!this._languageDims) {
            this._languageDims = data.dimentions; // note typo in language server
          }

          if (this._languageDims !== data.dimentions) {
            throw new Error('Language sources have different dimensions');
          }

          this._validProvidersCount++;
          data.languages.forEach(x => this.addProvider(x.lang, source, client));
        }, this.discoveryRetryPolicy);
      } catch (err) {
        this.handleLanguageServerError(err, source.endpoint, logger);
      }
    });
    debug(`loaded ${Object.keys(this.langs).length} languages from ${sources.length} sources`);
    await this.restoreVectorsCache();
    await this.restoreJunkWordsCache();
    await this.restoreTokensCache();
    return this;
  }

  async dumpTokensCache() {
    try {
      await _fsExtra.default.ensureFile(this._tokensCachePath);
      await _fsExtra.default.writeJson(this._tokensCachePath, this._tokensCache.dump());
      debug('tokens cache updated at: %s', this._tokensCachePath);
    } catch (err) {
      debug('could not persist tokens cache, error: %s', err.message);
      this._cacheDumpDisabled = true;
    }
  }

  async restoreTokensCache() {
    try {
      if (await _fsExtra.default.pathExists(this._tokensCachePath)) {
        const dump = await _fsExtra.default.readJSON(this._tokensCachePath);

        this._tokensCache.load(dump);
      }
    } catch (err) {
      debug('could not restore tokens cache, error: %s', err.message);
    }
  }

  async dumpVectorsCache() {
    try {
      await _fsExtra.default.ensureFile(this._vectorsCachePath);
      await _fsExtra.default.writeJSON(this._vectorsCachePath, this._vectorsCache.dump());
      debug('vectors cache updated at: %s', this._vectorsCachePath);
    } catch (err) {
      debug('could not persist vectors cache, error: %s', err.message);
      this._cacheDumpDisabled = true;
    }
  }

  async restoreVectorsCache() {
    try {
      if (await _fsExtra.default.pathExists(this._vectorsCachePath)) {
        const dump = await _fsExtra.default.readJSON(this._vectorsCachePath);

        if (dump) {
          const kve = dump.map(x => ({
            e: x.e,
            k: x.k,
            v: Float32Array.from(Object.values(x.v))
          }));

          this._vectorsCache.load(kve);
        }
      }
    } catch (err) {
      debug('could not restore vectors cache, error: %s', err.message);
    }
  }

  async dumpJunkWordsCache() {
    try {
      await _fsExtra.default.ensureFile(this._junkwordsCachePath);
      await _fsExtra.default.writeJSON(this._junkwordsCachePath, this._junkwordsCache.dump());
      debug('junk words cache updated at: %s', this._junkwordsCache);
    } catch (err) {
      debug('could not persist junk cache, error: %s', err.message);
      this._cacheDumpDisabled = true;
    }
  }

  async restoreJunkWordsCache() {
    try {
      if (await _fsExtra.default.pathExists(this._junkwordsCachePath)) {
        const dump = await _fsExtra.default.readJSON(this._junkwordsCachePath);

        this._vectorsCache.load(dump);
      }
    } catch (err) {
      debug('could not restore junk cache, error: %s', err.message);
    }
  }

  getHealth() {
    return {
      validProvidersCount: this._validProvidersCount,
      validLanguages: Object.keys(this.langs)
    };
  }

  getAvailableProviders(lang) {
    if (!this.langs[lang]) {
      throw new Error(`Language "${lang}" is not supported by the configured language sources`);
    }

    return this.langs[lang].filter(x => !x.disabledUntil || x.disabledUntil <= new Date());
  }

  async queryProvider(lang, path, body, returnProperty) {
    const providers = this.getAvailableProviders(lang);

    for (const provider of providers) {
      try {
        const {
          data
        } = await provider.client.post(path, { ...body,
          lang
        });

        if (data && data[returnProperty]) {
          return data[returnProperty];
        }

        return data;
      } catch (err) {
        debug('error from language server', {
          message: err.message,
          code: err.code,
          status: err.status,
          payload: body
        });

        if (this.getAvailableProviders(lang).length > 1) {
          // we don't disable providers when there's no backup
          provider.disabledUntil = (0, _moment.default)().add(provider.errors++, 'seconds').toDate();
          debug('disabled temporarily source', {
            source: provider.source,
            err: err.message,
            errors: provider.errors,
            until: provider.disabledUntil
          });
        }
      }
    }

    throw new Error(`No provider could successfully fullfil request "${path}" for lang "${lang}"`);
  }
  /**
   * Generates words that don't exist in the vocabulary, but that are built from ngrams of existing vocabulary
   * @param subsetVocab The tokens to which you want similar tokens to
   */


  async generateSimilarJunkWords(subsetVocab, lang) {
    // TODO: we can remove await + lang
    // from totalVocab compute the cachedKey the closest to what we have
    // if 75% of the vocabulary is the same, we keep the cache we have instead of rebuilding one
    const gramset = (0, _strings.vocabNGram)(subsetVocab);
    let result;

    this._junkwordsCache.forEach((junk, vocab) => {
      if (!result) {
        const sim = (0, _strings.setSimilarity)(vocab, gramset);

        if (sim >= 0.75) {
          result = junk;
        }
      }
    });

    if (!result) {
      // didn't find any close gramset, let's create a new one
      result = this.generateJunkWords(subsetVocab, gramset); // randomly generated words

      await this.vectorize(result, lang); // vectorize them all in one request to cache the tokens // TODO: remove this

      this._junkwordsCache.set(gramset, result);

      await this.onJunkWordsCacheChanged();
    }

    return result;
  }

  generateJunkWords(subsetVocab, gramset) {
    const realWords = _lodash.default.uniq(subsetVocab);

    const meanWordSize = _lodash.default.meanBy(realWords, w => w.length);

    const minJunkSize = Math.max(JUNK_TOKEN_MIN, meanWordSize / 2); // Twice as short

    const maxJunkSize = Math.min(JUNK_TOKEN_MAX, meanWordSize * 1.5); // A bit longer.  Those numbers are discretionary and are not expected to make a big impact on the models.

    return _lodash.default.range(0, JUNK_VOCAB_SIZE).map(() => {
      const finalSize = _lodash.default.random(minJunkSize, maxJunkSize, false);

      let word = '';

      while (word.length < finalSize) {
        word += _lodash.default.sample(gramset);
      }

      return word;
    }); // randomly generated words
  }

  async vectorize(tokens, lang) {
    if (!tokens.length) {
      return [];
    }

    const vectors = Array(tokens.length);
    const idxToFetch = []; // the tokens we need to fetch remotely

    const getCacheKey = t => `${lang}_${encodeURI(t)}`;

    tokens.forEach((token, i) => {
      if ((0, _tokenUtils.isSpace)(token)) {
        vectors[i] = new Float32Array(this._languageDims); // float 32 Arrays are initialized with 0s
      } else if (this._vectorsCache.has(getCacheKey(token))) {
        vectors[i] = this._vectorsCache.get(getCacheKey(token));
      } else {
        idxToFetch.push(i);
      }
    });

    while (idxToFetch.length) {
      // we tokenize maximum 100 tokens at the same time
      const group = idxToFetch.splice(0, 100); // We have new tokens we haven't cached yet

      const query = group.map(idx => tokens[idx].toLowerCase()); // Fetch only the missing tokens

      if (!query.length) {
        break;
      }

      const fetched = await this.queryProvider(lang, '/vectorize', {
        tokens: query
      }, 'vectors');

      if (fetched.length !== query.length) {
        throw new Error(`Language Provider didn't receive as many vectors as we asked for (asked ${query.length} and received ${fetched.length})`);
      } // Reconstruct them in our array and cache them for future cache lookup


      group.forEach((tokenIdx, fetchIdx) => {
        vectors[tokenIdx] = Float32Array.from(fetched[fetchIdx]);

        this._vectorsCache.set(getCacheKey(tokens[tokenIdx]), vectors[tokenIdx]);
      });
      await this.onVectorsCacheChanged();
    }

    return vectors;
  }

  async tokenize(utterances, lang, vocab = {}) {
    if (!utterances.length) {
      return [];
    }

    const getCacheKey = t => `${lang}_${encodeURI(t)}`;

    const tokenUtterances = Array(utterances.length);
    const idxToFetch = []; // the utterances we need to fetch remotely

    utterances.forEach((utterance, idx) => {
      if (this._tokensCache.has(getCacheKey(utterance))) {
        tokenUtterances[idx] = this._tokensCache.get(getCacheKey(utterance));
      } else {
        idxToFetch.push(idx);
      }
    }); // At this point, final[] contains the utterances we had cached
    // It has some "holes", we kept track of the indices where those wholes are in `idxToFetch`

    while (idxToFetch.length) {
      // While there's utterances we haven't tokenized yet
      // We're going to batch requests by maximum 150KB worth's of utterances
      let totalSize = 0;
      const sliceUntil = idxToFetch.reduce((topIdx, idx, i) => {
        if ((totalSize += utterances[idx].length * 4) < MAX_PAYLOAD_SIZE) {
          return i;
        } else {
          return topIdx;
        }
      }, 0);
      const batch = idxToFetch.splice(0, sliceUntil + 1);
      const query = batch.map(idx => utterances[idx].toLowerCase());

      if (!query.length) {
        break;
      }

      let fetched = await this.queryProvider(lang, '/tokenize', {
        utterances: query
      }, 'tokens');
      fetched = fetched.map(toks => (0, _tokenUtils.processUtteranceTokens)(toks, vocab));

      if (fetched.length !== query.length) {
        throw new Error(`Language Provider didn't receive as many utterances as we asked for (asked ${query.length} and received ${fetched.length})`);
      } // Reconstruct them in our array and cache them for future cache lookup


      batch.forEach((utteranceIdx, fetchIdx) => {
        tokenUtterances[utteranceIdx] = Array.from(fetched[fetchIdx]);

        this._tokensCache.set(getCacheKey(utterances[utteranceIdx]), tokenUtterances[utteranceIdx]);
      });
      await this.onTokensCacheChanged();
    } // we restore original chars and casing


    return tokenUtterances.map((tokens, i) => (0, _tokenUtils.restoreOriginalUtteranceCasing)(tokens, utterances[i]));
  }

}

exports.RemoteLanguageProvider = RemoteLanguageProvider;

var _default = new RemoteLanguageProvider();

exports.default = _default;
//# sourceMappingURL=language-provider.js.map