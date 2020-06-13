"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

require("bluebird-global");

var _en = _interopRequireDefault(require("../translations/en.json"));

var _fr = _interopRequireDefault(require("../translations/fr.json"));

var _dialogConditions = _interopRequireDefault(require("./dialog-conditions"));

var _entitiesService = _interopRequireDefault(require("./entities/entities-service"));

var _intentService = require("./intents/intent-service");

var _onBotMount = require("./module-lifecycle/on-bot-mount");

var _onBotUnmount = require("./module-lifecycle/on-bot-unmount");

var _onServerReady = require("./module-lifecycle/on-server-ready");

var _onServerStarted = require("./module-lifecycle/on-server-started");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const state = {
  nluByBot: {}
};
const onServerStarted = (0, _onServerStarted.getOnSeverStarted)(state);
const onServerReady = (0, _onServerReady.getOnServerReady)(state);
const onBotMount = (0, _onBotMount.getOnBotMount)(state);
const onBotUnmount = (0, _onBotUnmount.getOnBotUnmount)(state);

const onModuleUnmount = async bp => {
  bp.events.removeMiddleware('nlu.incoming');
  bp.http.deleteRouterForBot('nlu'); // if module gets deactivated but server keeps running, we want to destroy bot state

  Object.keys(state.nluByBot).forEach(botID => () => onBotUnmount(bp, botID));
};

const onTopicChanged = async (bp, botId, oldName, newName) => {
  const isRenaming = !!(oldName && newName);
  const isDeleting = !newName;

  if (!isRenaming && !isDeleting) {
    return;
  }

  const ghost = bp.ghost.forBot(botId);
  const entityService = new _entitiesService.default(ghost, botId);
  const intentDefs = await (0, _intentService.getIntents)(ghost);

  for (const intentDef of intentDefs) {
    const ctxIdx = intentDef.contexts.indexOf(oldName);

    if (ctxIdx !== -1) {
      intentDef.contexts.splice(ctxIdx, 1);

      if (isRenaming) {
        intentDef.contexts.push(newName);
      }

      await (0, _intentService.updateIntent)(ghost, intentDef.name, intentDef, entityService);
    }
  }
};

const entryPoint = {
  onServerStarted,
  onServerReady,
  onBotMount,
  onBotUnmount,
  onModuleUnmount,
  dialogConditions: _dialogConditions.default,
  onTopicChanged,
  translations: {
    en: _en.default,
    fr: _fr.default
  },
  definition: {
    name: 'nlu',
    moduleView: {
      stretched: true
    },
    menuIcon: 'translate',
    menuText: 'NLU',
    fullName: 'NLU',
    homepage: 'https://botpress.com'
  }
};
var _default = entryPoint;
exports.default = _default;
//# sourceMappingURL=index.js.map