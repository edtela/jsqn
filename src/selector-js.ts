// Copyright 2022 Edvin Tela. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { ArrayData, Data, isTerminal, ObjectData } from './data';
import { ComplexSelector, FieldSelector, isTerminalSelector, Selector } from './selector';

export const ALL_OP = '*';

export type SelectorFn = (v: Data) => Data;

function cloneFn(v: Data): Data {
  return JSON.parse(JSON.stringify(v));
}

export interface ResolvedFunction {
  fn: (...input: any) => Data;
}

export interface SelectorResolver {
  resolveFunction(name: string): ResolvedFunction;
  resolveKey(key: string): string | number;
}

type index = string | number;
function isIndex(v: unknown): v is index {
  return typeof v === 'string' || typeof v === 'number';
}

export interface CompileResult {
  select: index | boolean;
  fn?: SelectorFn;
}

function compileSelector(s: Selector, r: SelectorResolver): CompileResult {
  if (s === false || s === null) {
    return { select: false };
  }

  if (s === true) {
    return { select: true };
  }

  if (typeof s === 'number') {
    throw Error('NYI');
  }

  if (typeof s === 'string') {
    throw Error('NYI');
  }

  if (Array.isArray(s)) {
    return compileComplexSelector(s, r);
  }

  return compileFieldSelector(s, r);
}

function compileComplexSelector(s: ComplexSelector, r: SelectorResolver): CompileResult {
  if (s.length === 0) {
    return compileSelector(true, r);
  }

  const first = s[0];
  if (s.length === 1) {
    if (typeof first !== 'object') {
      return { select: first };
    }
    throw Error('NYI');
  }

  const rest = s.slice(1);
  if (typeof first === 'string') {
    return compileFunction(first, rest, r);
  }

  if (rest.length === 1) {
    //    return { type: 'chain', first: parseSelector(first, destKey), next: rest[0] };
  }

  //  return { type: 'chain', first: parseSelector(first, destKey), next: rest };

  throw Error('NYI');
}

function compileFunction(fnName: string, fnArgs: ArrayData, resolver: SelectorResolver): CompileResult {
  const parsedArgs: ({ type: 'select'; value: index | boolean } | { type: 'const'; value: any })[] = fnArgs.map((t) => {
    if (Array.isArray(t)) {
      if (t.length === 0) {
        return { type: 'select', value: true };
      }

      if (t.length === 1) {
        const t0 = t[0];

        if (isIndex(t0)) return { type: 'select', value: t0 };
        if (Array.isArray(t0)) return { type: 'const', value: t0 };

        if (t0 != null && typeof t0 === 'object') {
          return { type: 'const', value: compileSelector(t0, resolver).fn };
        }

        throw Error(`UNKNOWN ARG CASE: ${t0}`);
      }
    }

    return { type: 'const', value: t };
  });

  const fn = resolver.resolveFunction(fnName)?.fn;
  if (fn == null) {
    throw Error('Unknown function: ' + fnName);
  }

  if (parsedArgs.length === 0) {
    // special case: go straight to function
    return { select: true, fn: fn };
  }

  if (parsedArgs.length === 1) {
    const parsedArg = parsedArgs[0];
    if (parsedArg.type === 'select') {
      // special case: go straight to function
      return { select: parsedArg.value, fn: fn };
    }
    throw Error(`TODO: NO ARG FUNCTION: ${fnName}`);
  }

  const argFns: [index | boolean, number][] = [];
  const args: any[] = [];
  parsedArgs.forEach((pa, i) => {
    if (pa.type === 'select') {
      argFns.push([pa.value, i]);
    } else {
      args[i] = pa.value;
    }
  });

  if (argFns.length !== 1) {
    throw Error(`TODO: NO-INPUT, MULTI-INPUT FUNCTION: ${fnName}`);
  }

  const [key, index] = argFns[0];
  return {
    select: key,
    fn: function (v: Data) {
      args[index] = v;
      return fn(...args);
    },
  };
}

function compileFieldSelector(s: FieldSelector, r: SelectorResolver): CompileResult {
  const writer = new Copier();
  Object.keys(s).forEach((key) => {
    const resolvedKey = r.resolveKey(key);
    writer.addCopy(resolvedKey, compileSelector(s[key], r));
  });

  return { select: true, fn: writer.compile(r) };
}

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

  addCopy(destKey: index, cr: CompileResult) {
    if (cr.select === false) {
      //TODO exclude
      return;
    }

    const srcKey = cr.select === true ? destKey : cr.select;
    const compiler = this.getOrCreateCompiler(srcKey, destKey);
    if (compiler == null) {
      this.logger.incompatibleTypes(`${srcKey} -> ${destKey}`);
    } else {
      compiler.add(srcKey, destKey, cr.fn);
    }
  }

  compile(resolver: SelectorResolver) {
    return this.compiler?.compile(resolver) ?? ((v: any) => null);
  }
}

abstract class CopyCompiler<S extends index, D extends index> {
  protected readers = new Map<D, [S, SelectorFn?] | false>();
  protected all?: { fn?: SelectorFn };

  constructor(readonly srcType: string, readonly destType: string, readonly logger: CompileLogger) {}

  add(srcKey: S, destKey: D, fn?: SelectorFn) {
    this.setKey(destKey, [srcKey, fn]);
  }

  exclude(key: D) {
    this.setKey(key, false);
  }

  selectAll(fn?: SelectorFn) {
    this.all = { fn: fn };
  }

  protected setKey(key: D, value: [S, SelectorFn?] | false) {
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
        const [srcKey, fn] = reader;
        resolved.push({ destKey: key, srcKey: reader[0], fn: fn });
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

export class DefaultSelectorResolver implements SelectorResolver {
  resolveFunction(name: string): ResolvedFunction {
    if (name === 'abs') {
      return { fn: Math.abs };
    }
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
    return compileFieldSelector(s, this).fn ?? ((v: Data) => null);
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
