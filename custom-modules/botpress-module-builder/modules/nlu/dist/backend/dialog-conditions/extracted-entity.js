"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _default = {
  id: 'extracted_entity',
  label: `An entity was extracted from the user's message`,
  description: `Entity {type} {comparison} {value}`,
  params: {
    type: {
      required: true,
      label: 'Select the type of entity',
      type: 'list',
      list: {
        endpoint: 'BOT_API_PATH/mod/nlu/entities',
        valueField: 'label',
        labelField: 'label'
      }
    },
    comparison: {
      label: 'Comparison method',
      type: 'list',
      list: {
        items: [{
          label: 'None',
          value: 'none'
        }, {
          label: 'Equal',
          value: 'equal'
        }, {
          label: 'Not equal',
          value: 'notEqual'
        }, {
          label: 'Bigger than',
          value: 'biggerThan'
        }, {
          label: 'Less than',
          value: 'lessThan'
        }]
      }
    },
    expectedValue: {
      label: 'Expected value',
      type: 'string'
    }
  },
  evaluate: (event, params) => {
    var _event$nlu, _event$nlu$entities, _entity$data;

    const {
      type,
      comparison,
      expectedValue
    } = params;
    const entity = (_event$nlu = event.nlu) === null || _event$nlu === void 0 ? void 0 : (_event$nlu$entities = _event$nlu.entities) === null || _event$nlu$entities === void 0 ? void 0 : _event$nlu$entities.find(x => x.type === type);

    if (!entity) {
      return 0;
    } else if (!comparison || !expectedValue || comparison === 'none') {
      return 1;
    }

    const entityValue = (_entity$data = entity.data) === null || _entity$data === void 0 ? void 0 : _entity$data.value;
    return comparison === 'equal' && entityValue === expectedValue || comparison === 'notEqual' && entityValue !== expectedValue || comparison === 'biggerThan' && entityValue > expectedValue || comparison === 'lessThan' && entityValue < expectedValue ? 1 : 0;
  }
};
exports.default = _default;
//# sourceMappingURL=extracted-entity.js.map