// Copyright 2022 Edvin Tela. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { Data } from './src/data';
import { Selector } from './src/selector';

export const TEST_DATA = [
  {
    kind: 'dog',
    name: 'Luna',
    is: 'feisty',
    weight: 10,
  },
  {
    kind: 'cat',
    name: 'Ola',
    is: 'playful',
    weight: 5,
  },
  {
    kind: 'dog',
    name: 'Bobo',
    is: 'thoughtful',
    weight: 20,
  },
  {
    kind: 'lion',
    name: 'King',
    is: 'thoughtful',
    weight: 100,
  },
];

export const TEST_CASES: { comment: string; selector?: Selector; result?: Data }[] = [
  {
    comment: 'To select properties mark them **true** or with empty accesor **[]**',
    selector: { '0': { name: true, kind: [] } },
    result: [{ name: 'Luna', kind: 'dog' }],
  },
  {
    comment: 'To select all properties use "*" operator',
    selector: { '0': { '*': true, is: false, weight: false } },
    result: [{ name: 'Luna', kind: 'dog' }],
  },
  {
    comment: 'To rename a property use the property accessor. The following assigns **name** to **first_name**',
    selector: { '0': { first_name: ['name'] } },
    result: [{ first_name: 'Luna' }],
  },
  {
    comment: 'Object selection distributes through arrays. The following selects **name** for all animals',
    selector: { name: [] },
    result: [{ name: 'Luna' }, { name: 'Ola' }, { name: 'Bobo' }, { name: 'King' }],
  },
  {
    comment: `In general anything inside **{}** represents the structure of the output. Anything inside **[]**
        is a transformation of the current object. Property access is the simplest transformation, and in the case of
        empty **[]** the name of the property is taken from the selector. So, **{ name: ['name'] }** and **{ name: [] }** are equivalent`,
  },
  {
    comment: 'Transformations can be chained. The output of the first is input to the next',
    selector: { 'Luna is': [[0], ['is']] },
    result: { 'Luna is': 'feisty' },
  },
  {
    comment: 'To assign a constant value, enclose it in double square brackets',
    selector: { static: [[1], [['This can be anything, including a static array']]] },
    result: { static: 'This can be anything, including a static array' },
  },
  {
    comment:
      'Custom or built-in functions can be used. The function syntax is **["function_name", ...args]**. The function name can be anywhere in a chain of transformations. Anything after the function name is an argument. If an argument is an array, it is resolved the same as other transformations',
    selector: { 'First Dog is': [[0], 'uppercase', ['name']] },
    result: { 'First Dog is': 'LUNA' },
  },
  {
    comment: '## Filtering',
  },
  {
    comment:
      'Filtering is specified using the **?** operator as key and a predicate as value. A primitive value implies equality',
    selector: { name: true, '?': { kind: 'cat' } },
    result: [{ name: 'Ola' }],
  },
  {
    comment:
      'A filter can appear anywhere in a path. Unlike the previous example, **kind** is included in the output since it appears in the selector path rather than the predicate. The predicate uses RegExp operator.',
    selector: { name: true, kind: { '?': { '~': '.*at' } } },
    result: [{ name: 'Ola', kind: 'cat' }],
  },
  {
    comment: 'Conditions can be AND-ed using **{}**',
    selector: { name: true, '?': { kind: 'dog', name: 'Bobo' } },
    result: [{ name: 'Bobo' }],
  },
  {
    comment: 'Conditions can be OR-ed using **[]**',
    selector: { name: true, '?': [{ kind: 'lion' }, { name: 'Ola' }] },
    result: [{ name: 'Ola' }, { name: 'King' }],
  },
  {
    comment: '## Aggregation',
  },
  {
    comment:
      'Aggregation is specified by providing an aggregation function in one of the properties. Properties that have no aggregation function are grouped',
    selector: { kind: true, weight: 'sum', '?': { kind: { '!': 'lion' } } },
    result: [
      { kind: 'dog', weight: 30 },
      { kind: 'cat', weight: 5 },
    ],
  },
  {
    comment: 'Data can be transformed prior to aggregation by specifying transforms after the aggregation function',
    selector: {
      names: ['values', 'uppercase', ['name']],
      kind: { '?': { '!': 'lion' } },
    },
    result: [
      { kind: 'dog', names: ['LUNA', 'BOBO'] },
      { kind: 'cat', names: ['OLA'] },
    ],
  },
];
