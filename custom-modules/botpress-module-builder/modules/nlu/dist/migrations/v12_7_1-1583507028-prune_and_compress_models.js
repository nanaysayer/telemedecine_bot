"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _modelService = require("../backend/model-service");

const migration = {
  info: {
    description: 'Prune and compress old models',
    target: 'bot',
    type: 'content'
  },
  up: async ({
    bp,
    metadata
  }) => {
    let hasChanged = false;

    const migrateModels = async bot => {
      const ghost = bp.ghost.forBot(bot.id);
      return Promise.mapSeries(bot.languages, async lang => {
        await (0, _modelService.pruneModels)(ghost, lang);
        const modNames = await (0, _modelService.listModelsForLang)(ghost, lang);
        return Promise.map(modNames, async mod => {
          try {
            const model = await ghost.readFileAsObject(_modelService.MODELS_DIR, mod);

            if (!model.hash) {
              return ghost.deleteFile(_modelService.MODELS_DIR, mod); // model is really outdated
            }

            hasChanged = true;
            return (0, _modelService.saveModel)(ghost, model, model.hash); // Triggers model compression
          } catch (err) {
            // model is probably an archive
            return;
          }
        });
      });
    };

    if (!metadata.botId) {
      const bots = await bp.bots.getAllBots();
      await Promise.map(bots.values(), migrateModels);
    }

    return {
      success: true,
      message: hasChanged ? 'Model compression completed successfully' : 'Nothing to compress, skipping...'
    };
  }
};
var _default = migration;
exports.default = _default;
//# sourceMappingURL=v12_7_1-1583507028-prune_and_compress_models.js.map