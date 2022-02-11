// Copyright 2022 Edvin Tela. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { isValue, Value } from './data';

export type Terminal = Value;

export function isTerminal(p: Selector): p is Terminal {
  return isValue(p);
}

export interface FieldSelector {
  [prop: string]: Selector;
}

export type ComplexSelector = Array<Selector>;

export type Selector = Terminal | FieldSelector | ComplexSelector;
