// Copyright 2022 Edvin Tela. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { Data } from './data';
import { equals } from './data-js';
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

describe('ALL', () => {
  beforeEach(function () {
    jasmine.addMatchers(customMatchers);
  });

  it('ALL', () => {
    TEST_CASES.forEach((c) => {
      if (c.selector) {
        const result = resolver.compile(c.selector)(TEST_DATA);
        if (c.result) {
          expect(result).toDeepEqual(c.result);
        }
      }
    });
  });
});
