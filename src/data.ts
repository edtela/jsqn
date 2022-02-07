// Copyright 2022 Edvin Tela. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

export type TerminalData = null | boolean | string | number;

export function isTerminal(p: Data): p is TerminalData {
  return p == null || typeof p != 'object';
}

export interface ObjectData {
  [prop: string]: Data;
}

export type ArrayData = Array<Data>;

export type Data = TerminalData | ObjectData | ArrayData;

export type Index = string | number;

export function isIndex(v: unknown): v is Index {
  return typeof v === 'string' || typeof v === 'number';
}

export function isString(v: unknown): v is string {
  return typeof v === 'string';
}

export function isNumber(v: unknown): v is number {
  return typeof v === 'number';
}

export type ArrayOrObject<T extends Index> = T extends number ? ArrayData : ObjectData;
