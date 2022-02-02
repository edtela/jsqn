// Copyright 2022 Edvin Tela. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { ArrayData, Data, isTerminal, ObjectData, TerminalData } from './data';
import { ComplexSelector, FieldSelector, isTerminalSelector, Selector } from './selector';

export const ALL_OP = '*';

export type SelectorFn = (v: Data) => Data;

export interface SelectorResolver {
  resolveFunction(name: string): undefined | SelectorFn;
  resolveKey(key: string): string | number;
}

// INSTRUCTION

interface Exclude {
  type: 'exclude';
  srcKey: string | number;
}

interface Copy {
  type: 'copy';
  srcKey: string | number;
  destKey: string | number;
}

interface Run {
  type: 'run';
  name: string;
  args: ArrayData;
}

interface Select {
  type: 'select';
  selector: FieldSelector;
}

interface Chain {
  type: 'chain';
  first: Instruction;
  next: Selector;
}

type Instruction = Exclude | Copy | Run | Select | Chain;

function toInstruction(s: Selector, destKey: string | number): Instruction {
  if (s === false || s === null) {
    return { type: 'exclude', srcKey: destKey };
  }

  if (s === true) {
    return { type: 'copy', srcKey: destKey, destKey: destKey };
  }

  if (typeof s === 'number') {
    return { type: 'copy', srcKey: s, destKey: destKey };
  }

  if (typeof s === 'string') {
    return { type: 'run', name: s, args: [] };
  }

  if (Array.isArray(s)) {
    return toInstructionX(s, destKey);
  }

  return { type: 'select', selector: s };
}

function toInstructionX(s: ComplexSelector, destKey: string | number): Instruction {
  if (s.length === 0) {
    return toInstruction(true, destKey);
  }

  const first = s[0];
  if (s.length === 1) {
    if (typeof first === 'string') {
      return { type: 'copy', srcKey: first, destKey: destKey };
    }
    return toInstruction(first, destKey);
  }

  const rest = s.slice(1);
  if (typeof first === 'string') {
    return { type: 'run', name: first, args: rest };
  }

  if (rest.length === 1) {
    return { type: 'chain', first: toInstruction(first, destKey), next: rest[0] };
  }

  return { type: 'chain', first: toInstruction(first, destKey), next: rest };
}

// COPY

type OACopy = (src: ObjectData | null, dest: ArrayData, nullValue?: TerminalData) => Data;
function oaCopy(srcKey: string, destKey: number): OACopy {
  return (src, dest, nullValue = null) => (dest[destKey] = src?.[srcKey] ?? nullValue);
}

type AACopy = (src: ArrayData | null, dest: ArrayData, nullValue?: TerminalData) => Data;
function aaCopy(srcKey: number, destKey: number): AACopy {
  return (src, dest, nullValue = null) => (dest[destKey] = src?.[srcKey] ?? nullValue);
}

type AOCopy = (src: ArrayData | null, dest: ObjectData, nullValue?: TerminalData) => Data;
function aoCopy(srcKey: number, destKey: string): AOCopy {
  return (src, dest, nullValue = null) => (dest[destKey] = src?.[srcKey] ?? nullValue);
}

type OOCopy = (src: ObjectData | null, dest: ObjectData, nullValue?: TerminalData) => Data;
function ooCopy(srcKey: string, destKey: string): OOCopy {
  return (src, dest, nullValue = null) => (dest[destKey] = src?.[srcKey] ?? nullValue);
}

function compileFieldSelector(s: FieldSelector, r: SelectorResolver): SelectorFn {
  const instructions = Object.keys(s).map((key) => {
    const resolvedKey = r.resolveKey(key);
    return toInstruction(s[key], resolvedKey);
  });

  const copyFns: [OACopy[], AACopy[], AOCopy[], OOCopy[]] = [[], [], [], []];

  instructions.forEach((t) => {
    if (t.type === 'copy') {
      if (typeof t.srcKey === 'string') {
        if (typeof t.destKey === 'number') {
          copyFns[0].push(oaCopy(t.srcKey, t.destKey));
        } else {
          copyFns[3].push(ooCopy(t.srcKey, t.destKey));
        }
      } else {
        if (typeof t.destKey === 'number') {
          copyFns[1].push(aaCopy(t.srcKey, t.destKey));
        } else {
          copyFns[2].push(aoCopy(t.srcKey, t.destKey));
        }
      }
    } else if (t.type === 'exclude') {
    } else {
      console.error(t);
      throw Error('NYI');
    }
  });

  const copier = copyFns.filter((c) => c.length > 0);
  if (copier.length > 1) {
    throw Error('INCOMPATIBLE');
  }

  if (copyFns[0].length > 0) {
    const fns = copyFns[0];

    const fn: SelectorFn = (src: Data) => {
      if (Array.isArray(src)) {
        return src.map((s) => fn(s));
      }

      const dest: ArrayData = [];
      if (isTerminal(src)) {
        fns.forEach((f) => f(null, dest, src));
      } else {
        fns.forEach((f) => f(src, dest));
      }

      // fill empty items
      for (let i = 0; i < dest.length; i++) {
        if (dest[i] == null) {
          dest[i] = null;
        }
      }

      return dest;
    };

    return fn;
  }

  if (copyFns[1].length > 0) {
    const fns = copyFns[1];

    const fn = (src: Data) => {
      const dest: ArrayData = [];
      if (isTerminal(src)) {
        fns.forEach((f) => f(null, dest, src));
      } else {
        const aSrc = Array.isArray(src) ? src : [src];
        fns.forEach((f) => f(aSrc, dest));

        // fill empty items
        for (let i = 0; i < dest.length; i++) {
          if (dest[i] == null) {
            dest[i] = null;
          }
        }
      }
      return dest;
    };

    return fn;
  }

  if (copyFns[2].length > 0) {
    const fns = copyFns[2];

    const fn = (src: Data) => {
      const dest: ObjectData = {};
      if (isTerminal(src)) {
        fns.forEach((f) => f(null, dest, src));
      } else {
        const aSrc = Array.isArray(src) ? src : [src];
        fns.forEach((f) => f(aSrc, dest));
      }
      return dest;
    };

    return fn;
  }

  if (copyFns[3].length > 0) {
    const fns = copyFns[3];

    const fn: SelectorFn = (src: Data) => {
      if (Array.isArray(src)) {
        return src.map((s) => fn(s));
      }

      const dest: ObjectData = {};
      if (isTerminal(src)) {
        fns.forEach((f) => f(null, dest, src));
      } else {
        fns.forEach((f) => f(src, dest));
      }

      return dest;
    };

    return fn;
  }

  throw Error('NOTHING DONE');
}

export class DefaultSelectorResolver implements SelectorResolver {
  resolveFunction(name: string): SelectorFn | undefined {
    throw new Error('Method not implemented.');
  }

  resolveKey(key: string): string | number {
    const index = parseInt(key);
    if (isNaN(index)) {
      return key;
    }
    return index;
  }

  compile(s: Selector) {
    if (isTerminalSelector(s) || Array.isArray(s)) {
      throw new Error('Method not implemented.');
    }
    return compileFieldSelector(s, this);
  }
}
