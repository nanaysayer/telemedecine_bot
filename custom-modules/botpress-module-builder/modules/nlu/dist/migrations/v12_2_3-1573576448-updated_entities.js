"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _validation = require("../backend/entities/validation");

const migration = {
  info: {
    description: 'Adds missing fields in custom entities',
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

        if (entityDef.type === 'pattern') {
          if (entityDef.matchCase === undefined) {
            entityDef.matchCase = false;
          }

          if (entityDef.examples === undefined) {
            entityDef.examples = [];
          }
        }

        if (entityDef.type === 'list') {
          if (entityDef.fuzzy) {
            entityDef.fuzzy = _validation.FuzzyTolerance.Medium;
          } else {
            entityDef.fuzzy = _validation.FuzzyTolerance.Strict;
          }
        }

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
      message: "Entities' fields updated successfully"
    };
  }
};
var _default = migration;
exports.default = _default;
//# sourceMappingURL=v12_2_3-1573576448-updated_entities.js.map