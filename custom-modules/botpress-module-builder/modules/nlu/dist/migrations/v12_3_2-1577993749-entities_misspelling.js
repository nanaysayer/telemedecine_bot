"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const migration = {
  info: {
    description: 'Updates misspelled property in custom entities',
    target: 'bot',
    type: 'content'
  },
  up: async ({
    bp,
    metadata
  }) => {
    const migrateBotEntities = async botId => {
      const bpfs = bp.ghost.forBot(botId);
      const entFiles = await bpfs.directoryListing('./entities', '*.json');

      for (const fileName of entFiles) {
        const entityDef = await bpfs.readFileAsObject('./entities', fileName);
        entityDef.occurrences = _lodash.default.cloneDeep(entityDef['occurences']);
        delete entityDef['occurences'];
        await bpfs.upsertFile('./entities', fileName, JSON.stringify(entityDef, undefined, 2));
      }
    };

    if (metadata.botId) {
      await migrateBotEntities(metadata.botId);
    } else {
      const bots = await bp.bots.getAllBots();
      await Promise.map(bots.keys(), botId => migrateBotEntities(botId));
    }

    return {
      success: true,
      message: "Entities' properties updated successfully"
    };
  }
};
var _default = migration;
exports.default = _default;
//# sourceMappingURL=v12_3_2-1577993749-entities_misspelling.js.map