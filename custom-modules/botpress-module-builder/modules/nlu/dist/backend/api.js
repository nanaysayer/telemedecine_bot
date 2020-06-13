"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.PredictSchema = void 0;

var _joi = _interopRequireWildcard(require("joi"));

var _lodash = _interopRequireDefault(require("lodash"));

var _autoTrain = require("./autoTrain");

var _validation = require("./entities/validation");

var _intentService = require("./intents/intent-service");

var _recommendations = _interopRequireDefault(require("./intents/recommendations"));

var _validation2 = require("./intents/validation");

var _onServerStarted = require("./module-lifecycle/on-server-started");

var _crossValidation = require("./tools/cross-validation");

var _trainSessionService = require("./train-session-service");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

const PredictSchema = _joi.default.object().keys({
  contexts: _joi.default.array().items(_joi.default.string()).default(['global']),
  text: _joi.default.string().required()
});

exports.PredictSchema = PredictSchema;

var _default = async (bp, state) => {
  const router = bp.http.createRouterForBot('nlu');
  router.get('/health', async (req, res) => {
    // When the health is bad, we'll refresh the status in case it changed (eg: user added languages)
    if (!state.health.isEnabled) {
      await (0, _onServerStarted.initializeLanguageProvider)(bp, state);
    }

    res.send(state.health);
  });
  router.post('/cross-validation/:lang', async (req, res) => {
    const {
      botId,
      lang
    } = req.params;
    const ghost = bp.ghost.forBot(botId);
    const intentDefs = await (0, _intentService.getIntents)(ghost);
    const entityDefs = await state.nluByBot[botId].entityService.getCustomEntities();
    bp.logger.forBot(botId).info('Started cross validation');
    const xValidationRes = await (0, _crossValidation.crossValidate)(botId, intentDefs, entityDefs, lang);
    bp.logger.forBot(botId).info('Finished cross validation');
    res.send(xValidationRes);
  });
  router.get('/training/:language', async (req, res) => {
    const {
      language,
      botId
    } = req.params;
    const session = await (0, _trainSessionService.getTrainingSession)(bp, botId, language);
    res.send(session);
  });
  router.post('/predict', async (req, res) => {
    const {
      botId
    } = req.params;
    const {
      error,
      value
    } = PredictSchema.validate(req.body);

    if (error) {
      return res.status(400).send('Predict body is invalid');
    }

    if (!state.nluByBot[botId]) {
      return res.status(404).send(`Bot ${botId} doesn't exist`);
    }

    try {
      const nlu = await state.nluByBot[botId].engine.predict(value.text, value.contexts);
      res.send({
        nlu
      });
    } catch (err) {
      res.status(500).send('Could not extract nlu data');
    }
  });
  router.get('/intents', async (req, res) => {
    const {
      botId
    } = req.params;
    const ghost = bp.ghost.forBot(botId);
    const intentDefs = await (0, _intentService.getIntents)(ghost);
    res.send(intentDefs);
  });
  router.get('/intents/:intent', async (req, res) => {
    const {
      botId,
      intent
    } = req.params;
    const ghost = bp.ghost.forBot(botId);
    const intentDef = await (0, _intentService.getIntent)(ghost, intent);
    res.send(intentDef);
  });
  router.post('/intents/:intent/delete', async (req, res) => {
    const {
      botId,
      intent
    } = req.params;
    const ghost = bp.ghost.forBot(botId);

    try {
      await (0, _intentService.deleteIntent)(ghost, intent);
      res.sendStatus(204);
    } catch (err) {
      bp.logger.forBot(botId).attachError(err).error('Could not delete intent');
      res.status(400).send(err.message);
    }
  });
  router.post('/intents', async (req, res) => {
    const {
      botId
    } = req.params;
    const ghost = bp.ghost.forBot(botId);

    try {
      const intentDef = await (0, _joi.validate)(req.body, _validation2.IntentDefCreateSchema, {
        stripUnknown: true
      });
      await (0, _intentService.saveIntent)(ghost, intentDef, state.nluByBot[botId].entityService);
      res.sendStatus(200);
    } catch (err) {
      bp.logger.forBot(botId).attachError(err).warn('Cannot create intent');
      res.status(400).send(err.message);
    }
  });
  router.post('/intents/:intentName', async (req, res) => {
    const {
      botId,
      intentName
    } = req.params;
    const ghost = bp.ghost.forBot(botId);

    try {
      await (0, _intentService.updateIntent)(ghost, intentName, req.body, state.nluByBot[botId].entityService);
      res.sendStatus(200);
    } catch (err) {
      bp.logger.forBot(botId).attachError(err).error('Could not update intent');
      res.sendStatus(400);
    }
  });
  router.post('/condition/intentChanged', async (req, res) => {
    const {
      botId
    } = req.params;
    const {
      action
    } = req.body;
    const condition = req.body.condition;

    if (action === 'delete' || action === 'create') {
      try {
        const ghost = bp.ghost.forBot(botId);
        await (0, _intentService.updateContextsFromTopics)(ghost, state.nluByBot[botId].entityService, [condition.params.intentName]);
        return res.sendStatus(200);
      } catch (err) {
        return res.status(400).send(err.message);
      }
    }

    res.sendStatus(200);
  });
  router.post('/sync/intents/topics', async (req, res) => {
    const {
      botId
    } = req.params;
    const {
      intentNames
    } = req.body;
    const ghost = bp.ghost.forBot(botId);

    try {
      await (0, _intentService.updateContextsFromTopics)(ghost, state.nluByBot[botId].entityService, intentNames);
      res.sendStatus(200);
    } catch (err) {
      bp.logger.forBot(botId).attachError(err).error('Could not update intent topics');
      res.status(400).send(err.message);
    }
  });
  router.get('/contexts', async (req, res) => {
    const botId = req.params.botId;
    const ghost = bp.ghost.forBot(botId);
    const intents = await (0, _intentService.getIntents)(ghost);

    const ctxs = _lodash.default.chain(intents).flatMap(i => i.contexts).uniq().value();

    res.send(ctxs);
  });
  router.get('/entities', async (req, res) => {
    const {
      botId
    } = req.params;
    const entities = await state.nluByBot[botId].entityService.getEntities();
    res.json(entities.map(x => ({ ...x,
      label: `${x.type}.${x.name}`
    })));
  });
  router.get('/entities/:entityName', async (req, res) => {
    const {
      botId,
      entityName
    } = req.params;

    try {
      const entity = await state.nluByBot[botId].entityService.getEntity(entityName);
      res.send(entity);
    } catch (err) {
      bp.logger.forBot(botId).attachError(err).error(`Could not get entity ${entityName}`);
      res.send(400);
    }
  });
  router.post('/entities', async (req, res) => {
    const {
      botId
    } = req.params;

    try {
      const entityDef = await (0, _joi.validate)(req.body, _validation.EntityDefCreateSchema, {
        stripUnknown: true
      });
      await state.nluByBot[botId].entityService.saveEntity(entityDef);
      res.sendStatus(200);
    } catch (err) {
      bp.logger.forBot(botId).attachError(err).warn('Cannot create entity');
      res.status(400).send(err.message);
    }
  });
  router.post('/entities/:id', async (req, res) => {
    const {
      botId,
      id
    } = req.params;

    try {
      const entityDef = await (0, _joi.validate)(req.body, _validation.EntityDefCreateSchema, {
        stripUnknown: true
      });
      await state.nluByBot[botId].entityService.updateEntity(id, entityDef);
      res.sendStatus(200);
    } catch (err) {
      bp.logger.forBot(botId).attachError(err).error('Could not update entity');
      res.status(400).send(err.message);
    }
  });
  router.post('/entities/:id/delete', async (req, res) => {
    const {
      botId,
      id
    } = req.params;

    try {
      await state.nluByBot[botId].entityService.deleteEntity(id);
      res.sendStatus(204);
    } catch (err) {
      bp.logger.forBot(botId).attachError(err).error('Could not delete entity');
      res.status(404).send(err.message);
    }
  });
  router.get('/train', async (req, res) => {
    try {
      const {
        botId
      } = req.params;
      const isTraining = await state.nluByBot[botId].isTraining();
      res.send({
        isTraining
      });
    } catch {
      res.sendStatus(500);
    }
  });
  router.post('/train', async (req, res) => {
    try {
      const {
        botId
      } = req.params;
      await state.nluByBot[botId].trainOrLoad(true);
      res.sendStatus(200);
    } catch {
      res.sendStatus(500);
    }
  });
  router.post('/train/delete', async (req, res) => {
    try {
      const {
        botId
      } = req.params;
      await state.nluByBot[botId].cancelTraining();
      res.sendStatus(200);
    } catch {
      res.sendStatus(500);
    }
  });
  router.get('/ml-recommendations', async (req, res) => {
    res.send(_recommendations.default);
  });
  router.post('/autoTrain', async (req, res) => {
    const {
      botId
    } = req.params;
    const {
      autoTrain
    } = req.body;
    await (0, _autoTrain.set)(bp, botId, autoTrain);
    res.sendStatus(200);
  });
  router.get('/autoTrain', async (req, res) => {
    const {
      botId
    } = req.params;
    const isOn = await (0, _autoTrain.isOn)(bp, botId);
    res.send({
      isOn
    });
  });
};

exports.default = _default;
//# sourceMappingURL=api.js.map