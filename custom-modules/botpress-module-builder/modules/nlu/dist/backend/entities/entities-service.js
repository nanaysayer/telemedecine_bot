"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var CacheManager = _interopRequireWildcard(require("../cache-manager"));

var _intentService = require("../intents/intent-service");

var _duckling_extractor = require("./duckling_extractor");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

const ENTITIES_DIR = './entities';

class EntitiesService {
  constructor(ghost, botId) {
    this.ghost = ghost;
    this.botId = botId;
  }

  sanitizeFileName(name) {
    return name.toLowerCase().replace(/\.json$/i, '').replace(/[\t\s]/gi, '-');
  }

  entityExists(entityName) {
    return this.ghost.fileExists(ENTITIES_DIR, `${entityName}.json`);
  }

  getSystemEntities() {
    return [..._duckling_extractor.DucklingEntityExtractor.entityTypes, 'any'].map(e => ({
      name: e,
      type: 'system'
    }));
  }

  async getCustomEntities() {
    const intentNames = await this.ghost.directoryListing(ENTITIES_DIR, '*.json');
    return Promise.mapSeries(intentNames, n => this.getEntity(n));
  }

  async getEntities() {
    return [...this.getSystemEntities(), ...(await this.getCustomEntities())];
  }

  async getEntity(entityName) {
    entityName = this.sanitizeFileName(entityName);

    if (!(await this.entityExists(entityName))) {
      throw new Error('Entity does not exist');
    }

    return this.ghost.readFileAsObject(ENTITIES_DIR, `${entityName}.json`);
  }

  async deleteEntity(entityName) {
    const nameSanitized = this.sanitizeFileName(entityName);

    if (!(await this.entityExists(nameSanitized))) {
      throw new Error('Entity does not exist');
    }

    CacheManager.deleteCache(entityName, this.botId);
    return this.ghost.deleteFile(ENTITIES_DIR, `${nameSanitized}.json`);
  }

  async saveEntity(entity) {
    const nameSanitized = this.sanitizeFileName(entity.name);
    return this.ghost.upsertFile(ENTITIES_DIR, `${nameSanitized}.json`, JSON.stringify(entity, undefined, 2));
  }

  async updateEntity(targetEntityName, entity) {
    const nameSanitized = this.sanitizeFileName(entity.name);
    const targetSanitized = this.sanitizeFileName(targetEntityName);

    if (targetSanitized !== nameSanitized) {
      // entity renamed
      CacheManager.copyCache(targetEntityName, entity.name, this.botId);
      await Promise.all([this.deleteEntity(targetSanitized), (0, _intentService.updateIntentsSlotsEntities)(this.ghost, targetSanitized, nameSanitized, this)]);
    } else {
      // entity changed
      CacheManager.getOrCreateCache(targetEntityName, this.botId).reset();
    }

    await this.saveEntity(entity);
  }

}

exports.default = EntitiesService;
//# sourceMappingURL=entities-service.js.map