// Copyright 2022 Edvin Tela. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { ArrayData, Data, isTerminal, ObjectData, TerminalData } from './data';
import { ComplexSelector, FieldSelector, isTerminalSelector, Selector } from './selector';

export const ALL_OP = '*';

export type SelectorFn = (v: Data) => Data;

function cloneFn(v: Data): Data {
  return JSON.parse(JSON.stringify(v));
}

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

function compileFieldSelector(s: FieldSelector, r: SelectorResolver): SelectorFn {
  const writer = new Copier();
  Object.keys(s).forEach((key) => {
    const resolvedKey = r.resolveKey(key);
    const instr = toInstruction(s[key], resolvedKey);
    if (instr.type === 'copy') {
      writer.addCopy(instr.destKey, new Reader(instr.srcKey));
    } else if (instr.type === 'select') {
      writer.addCopy(resolvedKey, new Reader(resolvedKey, instr.selector));
    }
  });

  return writer.compile(r);
}

type index = string | number;

class Copier {
  private compiler?: CopyCompiler<any, any>;

  constructor(private logger: CompileLogger = new CompileLogger()) {}

  private getOrCreateCompiler<S extends index, D extends index>(s: S, d: D): CopyCompiler<S, D> | undefined {
    if (this.compiler == null) {
      if (typeof s === 'string') {
        if (typeof d === 'string') {
          this.compiler = new O2OCompiler(this.logger);
        } else {
          this.compiler = new O2ACompiler(this.logger);
        }
      } else {
        if (typeof d === 'string') {
          this.compiler = new A2OCompiler(this.logger);
        } else {
          this.compiler = new A2ACompiler(this.logger);
        }
      }
    }

    if (this.compiler.srcType === typeof s && this.compiler.destType === typeof d) {
      return this.compiler;
    }
  }

  addCopy<S extends index, D extends index>(destKey: D, reader: Reader<S>) {
    const compiler = this.getOrCreateCompiler(reader.key, destKey);
    if (compiler == null) {
      this.logger.incompatibleTypes(`${reader.key} -> ${destKey}`);
    } else {
      compiler.add(destKey, reader);
    }
  }

  compile(resolver: SelectorResolver) {
    return this.compiler?.compile(resolver) ?? ((v: any) => null);
  }
}

abstract class CopyCompiler<S extends index, D extends index> {
  protected readers = new Map<D, Reader<S> | false>();
  protected all?: { fn?: SelectorFn };

  constructor(readonly srcType: string, readonly destType: string, readonly logger: CompileLogger) {}

  add(key: D, reader: Reader<S>) {
    this.setKey(key, reader);
  }

  exclude(key: D) {
    this.setKey(key, false);
  }

  selectAll(fn?: SelectorFn) {
    this.all = { fn: fn };
  }

  protected setKey(key: D, value: Reader<S> | false) {
    if (this.readers.has(key)) {
      this.logger.multipleWrites(key);
    }
    this.readers.set(key, value);
  }

  resolveReaders(resolver: SelectorResolver) {
    const resolved: { srcKey: S; destKey: D; fn?: SelectorFn }[] = [];
    const selectAll = this.all ? { fn: this.all.fn, excluded: new Set<D>() } : undefined;

    for (let [key, reader] of this.readers) {
      if (reader === false) {
        if (selectAll) selectAll.excluded.add(key);
      } else {
        const fn = reader.compile(resolver);
        resolved.push({ destKey: key, srcKey: reader.key, fn: fn });
      }
    }

    return { resolved: resolved, selectAll: selectAll };
  }

  abstract compile(resolver: SelectorResolver): SelectorFn;
}

abstract class ToArrayCompiler<S extends index> extends CopyCompiler<S, number> {
  constructor(readonly srcType: string, readonly logger: CompileLogger) {
    super(srcType, 'number', logger);
  }

  resolveReaders(resolver: SelectorResolver) {
    const { resolved, selectAll } = super.resolveReaders(resolver);

    const negative = resolved.filter((v) => v.destKey < 0).sort((a, b) => a.destKey - b.destKey);
    const positive = resolved.filter((v) => v.destKey >= 0);

    const readers = [];
    positive.forEach((p) => (readers[p.destKey] = p));

    for (let i = 0, j = 0; i < negative.length; i++) {
      while (readers[j] !== undefined) j++;
      readers[j] = negative[i];
    }

    return { resolved: readers, selectAll: selectAll };
  }

  abstract compile(resolver: SelectorResolver): SelectorFn;
}

class A2ACompiler extends ToArrayCompiler<number> {
  constructor(readonly logger: CompileLogger) {
    super('number', logger);
  }

  compile(resolver: SelectorResolver) {
    const { resolved, selectAll } = this.resolveReaders(resolver);

    return (src: Data) => {
      const dest: ArrayData = [];
      if (isTerminal(src)) {
        for (let i = 0; i < resolved.length; i++) {
          dest[i] = resolved[i] ? src : null;
        }
      } else {
        const aSrc = Array.isArray(src) ? src : [src];
        for (let destIndex = 0; destIndex < resolved.length; destIndex++) {
          const r = resolved[destIndex];
          if (r) {
            const value = r.srcKey < 0 ? aSrc[aSrc.length + r.srcKey] : aSrc[r.srcKey];
            dest[destIndex] = r.fn ? r.fn(value) : value;
          } else if (selectAll && !selectAll.excluded.has(destIndex)) {
            dest[destIndex] = aSrc[destIndex];
          }

          if (dest[destIndex] === undefined) {
            dest[destIndex] = null;
          }
        }

        if (selectAll) {
          for (let index = dest.length; index < aSrc.length; index++) {
            if (!selectAll.excluded.has(index)) {
              dest.push(aSrc[index] ?? null);
            }
          }
        }
      }
      return dest;
    };
  }
}

class O2ACompiler extends ToArrayCompiler<string> {
  constructor(readonly logger: CompileLogger) {
    super('string', logger);
  }

  compile(resolver: SelectorResolver) {
    const { resolved } = super.resolveReaders(resolver);

    const fn: SelectorFn = (src: Data) => {
      if (Array.isArray(src)) {
        return src.map((s) => fn(s));
      }

      const dest: ArrayData = [];
      if (isTerminal(src)) {
        for (let i = 0; i < resolved.length; i++) {
          dest[i] = resolved[i] ? src : null;
        }
      } else {
        for (let destIndex = 0; destIndex < resolved.length; destIndex++) {
          const r = resolved[destIndex];
          dest[destIndex] = r ? (r.fn ? r.fn(src[r.srcKey]) : src[r.srcKey]) ?? null : null;
        }
      }
      return dest;
    };

    return fn;
  }
}

class A2OCompiler extends CopyCompiler<number, string> {
  constructor(readonly logger: CompileLogger) {
    super('number', 'string', logger);
  }

  compile(resolver: SelectorResolver): SelectorFn {
    const { resolved } = this.resolveReaders(resolver);

    return function (src: Data) {
      const dest: ObjectData = {};
      if (isTerminal(src)) {
        resolved.forEach((r) => (dest[r.destKey] = src));
      } else {
        const arrSrc = Array.isArray(src) ? src : [src];
        for (let i = 0; i < resolved.length; i++) {
          const { srcKey, destKey, fn } = resolved[i];
          dest[destKey] = fn?.(arrSrc[srcKey]) ?? arrSrc[srcKey];
        }
      }
      return dest;
    };
  }
}

class O2OCompiler extends CopyCompiler<string, string> {
  constructor(readonly logger: CompileLogger) {
    super('string', 'string', logger);
  }

  compile(resolver: SelectorResolver): SelectorFn {
    const { resolved, selectAll } = this.resolveReaders(resolver);

    const fn: SelectorFn = function (src: Data) {
      if (Array.isArray(src)) {
        return src.map((e) => fn(e));
      }

      const dest: ObjectData = {};
      if (isTerminal(src)) {
        resolved.forEach((r) => (dest[r.destKey] = src));
      } else {
        resolved.forEach((r) => {
          dest[r.destKey] = (r.fn ? r.fn(src[r.srcKey]) : src[r.srcKey]) ?? null;
        });

        if (selectAll) {
          Object.keys(src).forEach((k) => {
            if (dest[k] === undefined && !selectAll.excluded.has(k)) {
              dest[k] = selectAll.fn ? selectAll.fn(src[k]) : src[k];
            }
          });
        }
      }

      return dest;
    };
    return fn;
  }
}

class Reader<T extends string | number> {
  constructor(readonly key: T, readonly selector?: FieldSelector) {}

  compile(resolver: SelectorResolver): SelectorFn | undefined {
    if (this.selector != null) {
      return compileFieldSelector(this.selector, resolver);
    }
  }
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

class CompileLogger {
  multipleWrites(k: string | number) {
    console.warn('Multiple writes: ', k);
  }

  incompatibleTypes(m: string) {
    console.warn(`Incompatible types, ignoring: ${m}`);
  }
}
