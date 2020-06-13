"use strict";

var _tfidf = _interopRequireDefault(require("./tfidf"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('TFIDF', () => {
  test('accuracy', () => {
    const docs = {
      A: 'one one one'.split(' '),
      B: 'one one two'.split(' '),
      C: 'one two three'.split(' ')
    };
    const o = (0, _tfidf.default)(docs);
    expect(o.A.one).toBeCloseTo(0.5);
    expect(o.A.__avg__).toBeCloseTo(0.5);
    expect(o.B.two).toBeCloseTo(0.5);
    expect(o.B.one).toBeCloseTo(0.5);
    expect(o.B.__avg__).toBeCloseTo(0.5);
    expect(o.C.one).toBeCloseTo(0.5);
    expect(o.C.two).toBeCloseTo(0.5);
    expect(o.C.three).toBeCloseTo(1.098);
    expect(o.C.__avg__).toBeCloseTo(0.699);
    expect(o.__avg__.one).toBeCloseTo(0.5);
    expect(o.__avg__.two).toBeCloseTo(0.5);
    expect(o.__avg__.three).toBeCloseTo(1.098);
  });
});
//# sourceMappingURL=tfidf.test.js.map