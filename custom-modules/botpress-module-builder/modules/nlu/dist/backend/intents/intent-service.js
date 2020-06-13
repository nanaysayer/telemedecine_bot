"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getIntents = getIntents;
exports.getIntent = getIntent;
exports.saveIntent = saveIntent;
exports.updateIntent = updateIntent;
exports.deleteIntent = deleteIntent;
exports.updateIntentsSlotsEntities = updateIntentsSlotsEntities;
exports.updateContextsFromTopics = updateContextsFromTopics;

var _lodash = _interopRequireDefault(require("lodash"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const INTENTS_DIR = './intents';

function sanitizeFileName(name) {
  return name.toLowerCase().replace(/\.json$/i, '').replace(/[\t\s]/gi, '-');
}

function intentExists(ghost, intentName) {
  return ghost.fileExists(INTENTS_DIR, `${intentName}.json`);
}

async function getIntents(ghost) {
  const intentNames = await ghost.directoryListing(INTENTS_DIR, '*.json');
  return Promise.mapSeries(intentNames, n => getIntent(ghost, n));
}

async function getIntent(ghost, intentName) {
  intentName = sanitizeFileName(intentName);

  if (intentName.length < 1) {
    throw new Error('Invalid intent name, expected at least one character');
  }

  if (!(await intentExists(ghost, intentName))) {
    throw new Error('Intent does not exist');
  }

  return ghost.readFileAsObject(INTENTS_DIR, `${intentName}.json`);
}

async function saveIntent(ghost, intent, entityService) {
  const name = sanitizeFileName(intent.name);

  if (name.length < 1) {
    throw new Error('Invalid intent name, expected at least one character');
  }

  const availableEntities = await entityService.getEntities();

  _lodash.default.chain(intent.slots).flatMap('entities').uniq().forEach(entity => {
    if (!availableEntities.find(e => e.name === entity)) {
      throw Error(`"${entity}" is neither a system entity nor a custom entity`);
    }
  });

  await ghost.upsertFile(INTENTS_DIR, `${name}.json`, JSON.stringify(intent, undefined, 2));
  return intent;
}

async function updateIntent(ghost, name, content, entityService) {
  const intentDef = await getIntent(ghost, name);

  const merged = _lodash.default.merge(intentDef, content);

  if ((content === null || content === void 0 ? void 0 : content.name) !== name) {
    await deleteIntent(ghost, name);
    name = content.name;
  }

  return saveIntent(ghost, merged, entityService);
}

async function deleteIntent(ghost, intentName) {
  intentName = sanitizeFileName(intentName);

  if (!(await intentExists(ghost, intentName))) {
    throw new Error('Intent does not exist');
  }

  return ghost.deleteFile(INTENTS_DIR, `${intentName}.json`);
} // ideally this would be a filewatcher


async function updateIntentsSlotsEntities(ghost, prevEntityName, newEntityName, entityService) {
  _lodash.default.each((await getIntents(ghost)), async intent => {
    let modified = false;

    _lodash.default.each(intent.slots, slot => {
      _lodash.default.forEach(slot.entities, (e, index, arr) => {
        if (e === prevEntityName) {
          arr[index] = newEntityName;
          modified = true;
        }
      });
    });

    if (modified) {
      await updateIntent(ghost, intent.name, intent, entityService);
    }
  });
}
/**
 * This method read every workflow to extract their intent usage, so they can be in sync with their topics.
 * The list of intent names is not required, but it saves some processing
 */


async function updateContextsFromTopics(ghost, entityService, intentNames) {
  const flowsPaths = await ghost.directoryListing('flows', '*.flow.json');
  const flows = await Promise.map(flowsPaths, async flowPath => ({
    name: flowPath,
    ...(await ghost.readFileAsObject('flows', flowPath))
  }));
  const intents = {};

  for (const flow of flows) {
    const topicName = flow.name.split('/')[0];

    for (const node of flow.nodes.filter(x => x.type === 'trigger')) {
      var _match$params;

      const tn = node;
      const match = tn.conditions.find(x => x.id === 'user_intent_is');
      const name = match === null || match === void 0 ? void 0 : (_match$params = match.params) === null || _match$params === void 0 ? void 0 : _match$params.intentName;

      if (name && name !== 'none' && (!intentNames || intentNames.includes(name))) {
        intents[name] = _lodash.default.uniq([...(intents[name] || []), topicName]);
      }
    }
  }

  for (const intentName of Object.keys(intents)) {
    const intentDef = await getIntent(ghost, intentName);

    if (!_lodash.default.isEqual(intentDef.contexts.sort(), intents[intentName].sort())) {
      intentDef.contexts = intents[intentName];
      await saveIntent(ghost, intentDef, entityService);
    }
  }
}
//# sourceMappingURL=intent-service.js.map