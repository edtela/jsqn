// Copyright 2022 Edvin Tela. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

export type TerminalSelector = boolean | string;

export interface FieldSelector {
  [prop: string]: Selector;
}

export type ComplexSelector = Array<Selector>;

export type Selector = FieldSelector;
