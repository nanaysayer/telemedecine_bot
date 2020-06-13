"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
const migration = {
  info: {
    description: 'Migrates slots from type numeral to number',
    target: 'bot',
    type: 'config'
  },
  up: async ({
    bp,
    metadata
  }) => {
    const updateBot = async botId => {
      const bpfs = bp.ghost.forBot(botId);
      const intents = await bpfs.directoryListing('./intents', '*.json');

      for (const file of intents) {
        const content = await bpfs.readFileAsObject('./intents', file);
        content.slots = content.slots.map(slot => {
          if (slot.entities && slot.entities.length) {
            slot.entities = slot.entities.map(entity => entity === 'numeral' ? 'number' : entity);
          }

          return slot;
        });
        await bpfs.upsertFile('./intents', file, JSON.stringify(content, undefined, 2));
      }
    };

    if (metadata.botId) {
      await updateBot(metadata.botId);
    } else {
      const bots = await bp.bots.getAllBots();

      for (const botId of Array.from(bots.keys())) {
        await updateBot(botId);
      }
    }

    return {
      success: true,
      message: 'Slots migrated successfully'
    };
  }
};
var _default = migration;
exports.default = _default;
//# sourceMappingURL=v12_0_1-1562193005-migrate_numeral_entities_to_number.js.map