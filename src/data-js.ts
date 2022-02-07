// Copyright 2022 Edvin Tela. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { Data, isTerminal } from './data';

export function getKey(v: Data, key: string) {
  if (isTerminal(v)) return v;
  if (Array.isArray(v)) return null;
  return v[key] ?? null;
}

export function getIndex(data: Data, index: number) {
  if (isTerminal(data)) return data;
  if (Array.isArray(data)) return data[index] ?? null;
  return null;
}

export function equals(a: Data, b: Data): boolean {
  if (a === b) return true;

  if (typeof a === 'object' && typeof b === 'object') {
    if (Array.isArray(a)) {
      if (Array.isArray(b)) {
        return a.length === b.length && a.findIndex((v, i) => !equals(v, b[i])) < 0;
      }
      return false;
    } else {
      if (a == null) return a === b;
      if (b == null || Array.isArray(b)) return false;

      const ka = Object.keys(a).filter((k) => a[k] !== undefined);
      const kb = Object.keys(b).filter((k) => b[k] !== undefined);
      return ka.length === kb.length && ka.findIndex((k) => !equals(a[k], b[k])) < 0;
    }
  }

  return false;
}
