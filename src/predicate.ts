// Copyright 2022 Edvin Tela. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { isValue, Value } from './data';
import { ComplexSelector } from './selector';

export const PREDICATE_OP = '?';
export const NOT_OP = '!';

export type ValuePredicate = Value;

export function isValuePredicate(p: Predicate): p is ValuePredicate {
  return isValue(p);
}

export interface AndPredicate {
  [prop: string]: Predicate;
}

export type OrPredicate = Array<ValuePredicate | AndPredicate | ComplexSelector>;

export type Predicate = ValuePredicate | AndPredicate | OrPredicate;
