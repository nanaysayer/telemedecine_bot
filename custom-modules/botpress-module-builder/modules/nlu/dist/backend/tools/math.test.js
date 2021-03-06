"use strict";

var _math = require("./math");

describe('Math utils', () => {
  const vec0 = [];
  const vec1 = [1, 1, 1];
  const vec2 = [2, 2, 2];
  const vec3 = [4, 5, 6];
  test('VectorAdd', () => {
    expect(() => (0, _math.vectorAdd)(vec0, vec2)).toThrow();
    expect((0, _math.vectorAdd)(vec1, vec2)).toEqual([3, 3, 3]);
    expect((0, _math.vectorAdd)(vec1, vec2)).toEqual([3, 3, 3]);
    expect((0, _math.vectorAdd)(vec1, vec3)).toEqual([5, 6, 7]);
    expect((0, _math.vectorAdd)(vec1, vec2, vec3)).toEqual([7, 8, 9]);
  });
  test('ScalarMultiply', () => {
    expect((0, _math.scalarMultiply)(vec0, 2)).toEqual([]);
    expect((0, _math.scalarMultiply)(vec1, 2)).toEqual([2, 2, 2]);
  });
  test('ComputeNorm', () => {
    expect((0, _math.computeNorm)(vec0)).toEqual(0);
    expect((0, _math.computeNorm)(vec1)).toBeCloseTo(1.73, 2);
    expect((0, _math.computeNorm)(vec2)).toBeCloseTo(3.46, 2);
    expect((0, _math.computeNorm)(vec3)).toBeCloseTo(8.77, 2);
    expect((0, _math.computeNorm)([22, 21, 59, 4, -5, 36])).toBeCloseTo(75.78, 2);
  });
  test('AllInRange', () => {
    expect((0, _math.allInRange)([0.45, 0.55], 0.45, 0.55)).toBeFalsy();
    expect((0, _math.allInRange)([0.44, 0.55], 0.45, 0.55)).toBeFalsy();
    expect((0, _math.allInRange)([0.45, 0.56], 0.45, 0.55)).toBeFalsy();
    expect((0, _math.allInRange)([0.4, 0.6], 0.45, 0.55)).toBeFalsy();
    expect((0, _math.allInRange)([0.46, 0.54], 0.45, 0.55)).toBeTruthy();
    expect((0, _math.allInRange)([0.32, 0.32, 0.35], 0.3, 0.36)).toBeTruthy();
    expect((0, _math.allInRange)([], 0.3, 0.36)).toBeTruthy();
  }); // TODO add negative test case

  describe('ComputeQuantile', () => {
    test('Quartile', () => {
      expect((0, _math.computeQuantile)(4, 0, 10)).toEqual(1);
      expect((0, _math.computeQuantile)(4, 1, 10)).toEqual(1);
      expect((0, _math.computeQuantile)(4, 2, 10)).toEqual(1);
      expect((0, _math.computeQuantile)(4, 3, 10)).toEqual(2);
      expect((0, _math.computeQuantile)(4, 4, 10)).toEqual(2);
      expect((0, _math.computeQuantile)(4, 5, 10)).toEqual(2);
      expect((0, _math.computeQuantile)(4, 6, 10)).toEqual(3);
      expect((0, _math.computeQuantile)(4, 7, 10)).toEqual(3);
      expect((0, _math.computeQuantile)(4, 8, 10)).toEqual(4);
      expect((0, _math.computeQuantile)(4, 9, 10)).toEqual(4);
      expect((0, _math.computeQuantile)(4, 10, 10)).toEqual(4);
      expect((0, _math.computeQuantile)(4, 11, 10)).toEqual(4);
    });
    test('Tierce with lower bound', () => {
      expect((0, _math.computeQuantile)(3, 0.5, 2, 0.5)).toEqual(1);
      expect((0, _math.computeQuantile)(3, 0.52, 2, 0.5)).toEqual(1);
      expect((0, _math.computeQuantile)(3, 0.9, 2, 0.5)).toEqual(1);
      expect((0, _math.computeQuantile)(3, 1, 2, 0.5)).toEqual(1);
      expect((0, _math.computeQuantile)(3, 1.2, 2, 0.5)).toEqual(2);
      expect((0, _math.computeQuantile)(3, 1.4, 2, 0.5)).toEqual(2);
      expect((0, _math.computeQuantile)(3, 1.5, 2, 0.5)).toEqual(2);
      expect((0, _math.computeQuantile)(3, 1.7, 2, 0.5)).toEqual(3);
      expect((0, _math.computeQuantile)(3, 2, 2, 0.5)).toEqual(3);
    });
  });
});
//# sourceMappingURL=math.test.js.map