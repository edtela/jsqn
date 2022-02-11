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
      'Aggregation is specified by setting selection to an aggregation function. Properties that have no aggregation function are grouped',
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
  {
    comment: '## Sorting',
  },
  {
    comment:
      'Sorting is specified by setting selection to a number. A negative number specifies descending order. The absolute value of the number specifies the order of properties when sorting by multiple properties. The following sorts first by **kind** ascending, then by **weight** descdending ',
    selector: { name: true, kind: 1, weight: -2, '?': { kind: ['cat', 'dog'] } },
    result: [
      { kind: 'cat', name: 'Ola', weight: 5 },
      { kind: 'dog', name: 'Bobo', weight: 20 },
      { kind: 'dog', name: 'Luna', weight: 10 },
    ],
  },
  {
    comment: 'Data can be transformed prior to sorting by specifying transforms after the sort',
    selector: { name: true, kind: [1, 'uppercase', []], weight: -2, '?': { kind: ['cat', 'dog'] } },
    result: [
      { kind: 'CAT', name: 'Ola', weight: 5 },
      { kind: 'DOG', name: 'Bobo', weight: 20 },
      { kind: 'DOG', name: 'Luna', weight: 10 },
    ],
  },
  {
    comment: '## Arrays',
  },
  {
    comment:
      'Arrays can be manipulated just like objects. If keys of a selector are numeric, the result is an array rather than object. The following copies an object to an array',
    selector: { 0: { 0: ['kind'], 1: ['name'] } },
    result: [['dog', 'Luna']],
  },
  {
    comment:
      'When indexed with positive numbers, the resulting array is considered a tuple, i.e. indices specified exist regardless of empty spaces.',
    selector: { 0: { 1: ['kind'], 3: ['name'], 4: ['not defined'] } },
    result: [[null, 'dog', null, 'Luna', null]],
  },
  {
    comment: 'Use negative numbers to specify just ordering and ignore undefined values',
    selector: { 0: { '-10': ['kind'], '-15': ['not defined'], '-20': ['name'], '-21': ['not defined'] } },
    result: [['dog', 'Luna']],
  },
  {
    comment: 'The following copies an object to an array',
    selector: { 'First is named': [[0], ['name']], 'Second is': [[1], ['kind']] },
    result: { 'First is named': 'Luna', 'Second is': 'cat' },
  },
  {
    comment: 'Negative indices access the array from the end',
    selector: { 'Last is named': [[-1], ['name']], 'Second to last is': [[-2], ['kind']] },
    result: { 'Last is named': 'King', 'Second to last is': 'dog' },
  },
  {
    comment: 'And this fixes just the second index',
    selector: { '1': [[0], ['name']], '-200': [[1], ['name']], '-300': [[-2], ['name']] },
    result: ['Ola', 'Luna', 'Bobo'],
  },
];
