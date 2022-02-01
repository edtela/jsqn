// Copyright 2022 Edvin Tela. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { Data } from './data';
import { equals } from './data-js';
import { DefaultSelectorResolver } from './selector-js';

const resolver = new DefaultSelectorResolver();

describe('Copy Selector', () => {
  it('should copy fields marked true or []', () => {
    const result = resolver.compile({ a: true, c: [] })({ a: 5, b: 6, c: 7 });
    expect(equals(result, { a: 5, c: 7 })).toBeTrue();
  });

  it('should copy field specfied in []', () => {
    const result = resolver.compile({ c: ['a'] })({ a: 5, b: 6 });
    expect(equals(result, { c: 5 })).toBeTrue();
  });

  it('should copy object to array', () => {
    const result = resolver.compile({ '0': ['a'], '2': ['b'] })({ a: 5, b: 6, c: 7 });
    expect(equals(result, [5, null, 6])).toBeTrue();
  });

  it('should copy array to object', () => {
    const result = resolver.compile({ a: [0], b: 2 })([5, 6, 7]);
    expect(equals(result, { a: 5, b: 7 })).toBeTrue();
  });
});
