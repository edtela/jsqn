// Copyright 2022 Edvin Tela. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { Data } from './data';
import { equals } from './data-js';
import { Selector } from './selector';
import { DefaultSelectorResolver } from './selector-js';

import { TEST_CASES, TEST_DATA } from '../tests';

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

    const result = resolver.compile(selector)(TEST_DATA);
    // expect(result).toDeepEqual(expected);
  });
});

describe('Filtering', () => {
  beforeEach(function () {
    jasmine.addMatchers(customMatchers);
  });

  it('should filter objects', () => {
    const selector = { animals: { '?': { name: 'Luna' } } };
    const expected = {
      animals: [
        {
          kind: 'dog',
          name: 'Luna',
          character: 'feisty',
        },
      ],
    };

    //const result = resolver.compile(selector)(TEST_DATA);
    //expect(result).toDeepEqual(expected);
  });
});

describe('ALL', () => {
  beforeEach(function () {
    jasmine.addMatchers(customMatchers);
  });

  it('ALL', () => {
    TEST_CASES.forEach((c) => {
      if (c.query) {
        const result = resolver.compile(c.query)(TEST_DATA);
        if (c.result) {
          expect(result).toDeepEqual(c.result);
        }
      }
    });
  });
});

export const TEST_DATA1 = {
  animals: [
    {
      kind: 'dog',
      name: 'Luna',
      is: 'feisty',
    },
    {
      kind: 'cat',
      name: 'Ola',
      is: 'playful',
    },
    {
      kind: 'dog',
      name: 'Bobo',
      is: 'thoughtful',
    },
    {
      kind: 'lion',
      name: 'King',
      is: 'thoughtful',
    },
  ],
};

export const TEST_CASES1: { comment: string; query?: Selector; result?: Data }[] = [
  {
    comment: 'To select properties mark them **true** or with empty accesor **[]***',
    query: { animals: { '0': { name: true, kind: [] } } },
    result: { animals: [{ name: 'Luna', kind: 'dog' }] },
  },
  {
    comment: 'To rename a property use the property accessor. The following assigns **name** to **first_name**',
    query: { animals: { '0': { first_name: ['name'] } } },
    result: { animals: [{ first_name: 'Luna' }] },
  },
  {
    comment: `In general anything inside **{}** represents the structure of the output. Anything inside **[]**
    is a transformation of the current object. Property access is the simplest transformation, and in the case of
    empty **[]** the name of the property is taken from the query. So, *{ name: ['name'] }* and *{ name: [] }*
    are equivalent`,
  },
  {
    comment: 'Transformations can be chained. The output of the first is input to the next',
    query: { 'Luna is': [['animals'], [0], ['is']] },
    result: { 'Luna is': 'feisty' },
  },
];
