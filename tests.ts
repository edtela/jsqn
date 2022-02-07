// Copyright 2022 Edvin Tela. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { Data } from './src/data';
import { Selector } from './src/selector';

export const TEST_DATA = {
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

export const TEST_CASES: { comment: string; query?: Selector; result?: Data }[] = [
  {
    comment: 'To select properties mark them **true** or with empty accesor **[]**',
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
