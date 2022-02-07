// Copyright 2022 Edvin Tela. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { Data } from './data';
import { equals } from './data-js';
import { DefaultSelectorResolver } from './selector-js';

declare global {
  namespace jasmine {
    interface Matchers<T> {
      toDeepEqual(expected: Data): void;
    }
  }
}

const resolver = new DefaultSelectorResolver();

const customMatchers = {
  toDeepEqual: () => {
    return { compare: (expected: any, actual: any) => ({ pass: equals(expected, actual) }) };
  },
};

describe('Copy Selector', () => {
  beforeEach(function () {
    jasmine.addMatchers(customMatchers);
  });

  it('should copy object to object', () => {
    const source = { a: 5, b: { a: 6, b: 7, c: 8 } };
    const selector = { a: true, b: { c: [], d: ['b'] } };
    const expected = { a: 5, b: { c: 8, d: 7 } };

    const result = resolver.compile(selector)(source);
    expect(result).toDeepEqual(expected);
  });

  it('should copy object to array', () => {
    const source = { a: 5, b: 6, c: 7 };
    const selector = { '0': ['a'], '2': ['b'] };
    const expected = [5, null, 6];

    const result = resolver.compile(selector)(source);
    expect(result).toDeepEqual(expected);
  });

  it('should copy array to object', () => {
    const source = [5, 6, 7];
    const selector = { a: [0], b: [2] };
    const expected = { a: 5, b: 7 };

    const result = resolver.compile(selector)(source);
    expect(result).toDeepEqual(expected);
  });

  it('should copy array to array', () => {
    const source = [5, 6, 7];
    const selector = { '1': [0], '2': [1] };
    const expected = [null, 5, 6];

    const result = resolver.compile(selector)(source);
    expect(result).toDeepEqual(expected);
  });

  it('should use negative indices to specify ordering', () => {
    const source = [5, 6, 7];
    const selector = { '-1': [0], '-2': [1] };
    const expected = [5, 6];

    const result = resolver.compile(selector)(source);
    expect(result).toDeepEqual(expected);
  });
});

describe('Copy Selector', () => {
  beforeEach(function () {
    jasmine.addMatchers(customMatchers);
  });

  it('should call specified function', () => {
    const source = [-5, -6, -7];
    const selector = { 0: ['abs', [2]], 1: ['abs', []] };
    const expected = [7, 6];

    const result = resolver.compile(selector)(source);
    expect(result).toDeepEqual(expected);
  });
});

describe('Selector chaining', () => {
  beforeEach(function () {
    jasmine.addMatchers(customMatchers);
  });

  it('should chain property access', () => {
    const selector = { bestDog: [['animals'], [0], ['name']] };
    const expected = { bestDog: 'Luna' };

    const result = resolver.compile(selector)(testData);
    // expect(result).toDeepEqual(expected);
  });
});

const testData = {
  animals: [
    {
      kind: 'dog',
      name: 'Luna',
      gender: 'female',
    },
    {
      kind: 'cat',
      name: 'Ola',
      gender: 'female',
    },
    {
      kind: 'dog',
      name: 'Bobo',
      gender: 'male',
    },
    {
      kind: 'lion',
      name: 'King',
      gender: 'male',
    },
  ],
};
