// Copyright 2022 Edvin Tela. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import {
  ArrayData,
  ArrayOrObject,
  Data,
  Index,
  isIndex,
  isNumber,
  isString,
  isTerminal,
  ObjectData,
  TerminalData,
} from './data';
import { Predicate, PREDICATE_OP } from './predicate';
import { DefaultPredicateResolver, PredicateFn } from './predicate-js';
import { ComplexSelector, FieldSelector, isTerminalSelector, Selector } from './selector';

export const ALL_OP = '*';

export type SelectorFn = (v: Data) => Data | undefined;

function cloneFn(v: Data): Data {
  return JSON.parse(JSON.stringify(v));
}

export interface ResolvedTransform {
  fn: (...input: any) => Data;
}

export interface ResolvedAggregation {
  fn?: Accumulator;
}

export type Accumulator = () => {
  add: (v: Data) => void;
  get: () => Data;
};

export type ResolvedFunction = ResolvedTransform;

export type SelectorResolver = DefaultSelectorResolver;

export interface CompileResult {
  select: Index | boolean;
  fn?: SelectorFn;
  group?: Accumulator | true;
}

function compileSelector(s: Selector, r: SelectorResolver): CompileResult {
  if (s === false || s === null) {
    return { select: false };
  }

  if (s === true) {
    return { select: true };
  }

  if (typeof s === 'number') {
    throw Error('TODO: sorting');
  }

  if (typeof s === 'string') {
    return { select: true, group: r.resolveAggregator(s) };
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
    if (typeof first === 'string') {
      return { select: first };
    }

    if (typeof first === 'number') {
      return { select: first };
    }

    if (typeof first === 'object') {
      if (Array.isArray(first)) {
        return { select: true, fn: (v: Data) => first[0] };
      }
      return compileSelector(first, r);
    }

    throw Error('NYI: ' + first);
  }

  const rest = s.slice(1);
  const second = rest.length === 1 ? rest[0] : rest;
  if (typeof first === 'string') {
    const fn = r.resolveFunction(first);
    if (fn == null) {
      const cr = compileSelector(second, r);
      cr.group = r.resolveAggregator(first);
      return cr;
    }

    return compileFunction(first, rest, r);
  }

  const cr1 = compileSelector(first, r);
  const cr2 = compileFieldSelector({ '0': second }, r);

  //TODO
  const fn = (v: Data) => {
    return (<any>cr2.fn?.(v))?.[0];
  };

  return { select: cr1.select, fn: fn };
}

function compileFunction(fnName: string, fnArgs: ArrayData, resolver: SelectorResolver): CompileResult {
  const fn = resolver.resolveFunction(fnName)?.fn;
  if (fn == null) {
    throw Error('Unknown function: ' + fnName);
  }

  const parsedArgs: ({ type: 'select'; value: Index | boolean } | { type: 'const'; value: any })[] = fnArgs.map((t) => {
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

  const argFns: [Index | boolean, number][] = [];
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
  const compiler = fieldCompiler();

  Object.keys(s).forEach((key) => {
    const dKey = r.resolveKey(key);
    if (dKey === PREDICATE_OP) {
      compiler.filter(r.compilePredicate(s[key]));
      return;
    }

    const cr = compileSelector(s[key], r);
    if (dKey === ALL_OP) {
      compiler.selectAll(cr.fn);
      return;
    }

    if (cr.select === false) {
      compiler.exclude(dKey);
      return;
    }

    const sKey: Index = cr.select === true ? dKey : cr.select;
    compiler.add(sKey, dKey, cr.fn, cr.group);
  });

  return { select: true, fn: compiler.compile() };
}

type FieldList<S, D> = { sKey: S; dKey: D; mapper?: SelectorFn }[];
interface FieldQuery<S, D> {
  fields: FieldList<S, D>;
  selectAll?: { except: Set<D>; mapper?: SelectorFn };
  groups?: { groupBy: S[]; aggregate: { key: S; fn: Accumulator }[] };
  filter?: PredicateFn;
}

function fieldCompiler(logger = new CompileLogger()) {
  let all: { mapper?: SelectorFn };
  let predicate: PredicateFn;
  let grouped = false;

  type FieldMap<S, D> = Map<D, [S, SelectorFn?, Accumulator?] | null>;
  function builder<S, D>(isS: (s: unknown) => s is S, isD: (s: unknown) => s is D) {
    const fields: FieldMap<S, D> = new Map();

    function build() {
      const query: FieldQuery<S, D> = { fields: [], filter: predicate };
      query.selectAll = all ? { mapper: all.mapper, except: new Set<D>() } : undefined;
      query.groups = grouped ? { groupBy: [], aggregate: [] } : undefined;
      for (let [dKey, s] of fields) {
        if (s === null) {
          if (query.selectAll) query.selectAll.except.add(dKey);
        } else {
          const [sKey, mapper, aggregator] = s;
          if (query.groups) {
            if (aggregator) {
              query.groups.aggregate.push({ key: <any>dKey, fn: aggregator });
            } else {
              query.groups.groupBy.push(<any>dKey);
            }
          }
          query.fields.push({ dKey: dKey, sKey: sKey, mapper: mapper });
        }
      }

      return query;
    }

    function set(dKey: D, value: [S, SelectorFn?, Accumulator?] | null) {
      if (fields.has(dKey)) {
        return logger.multipleWrites(dKey);
      }

      fields.set(dKey, value);
      return true;
    }

    function add(sKey: Index, dKey: Index, mapper?: SelectorFn, accumulator?: Accumulator) {
      if (isS(sKey) && isD(dKey)) {
        return set(dKey, [sKey, mapper, accumulator]);
      }
      return logger.incompatibleTypes(`${sKey}->${dKey}`);
    }

    function exclude(dKey: Index) {
      if (isD(dKey)) {
        return set(dKey, null);
      }

      logger.incompatibleTypes(`Exclude ${dKey}`);
      return false;
    }

    return { add: add, exclude: exclude, toQuery: build };
  }

  function compiler() {
    function array() {
      function array() {
        const qb = builder<number, number>(isNumber, isNumber);

        function compile() {
          const query = qb.toQuery();
          return arrayReader(query, ...arrayWriter(query, arrayGet));
        }

        return { builder: qb, compile: compile };
      }

      function object() {
        const qb = builder<string, number>(isString, isNumber);

        function compile() {
          const query = qb.toQuery();
          return objectReader(query, ...arrayWriter(query, objectGet));
        }

        return { builder: qb, compile: compile };
      }

      return { from: { object: object, array: array } };
    }

    function object() {
      function array() {
        const qb = builder<number, string>(isNumber, isString);

        function compile() {
          const query = qb.toQuery();
          return arrayReader(query, ...objectWriter(query));
        }

        return { builder: qb, compile: compile };
      }

      function object() {
        const qb = builder<string, string>(isString, isString);

        function compile() {
          const query = qb.toQuery();
          return objectReader(query, ...objectWriter(query));
        }

        return { builder: qb, compile: compile };
      }

      return { from: { object: object, array: array } };
    }

    return { object: object, array: array };
  }

  let cpl: { builder: ReturnType<typeof builder>; compile: () => SelectorFn };
  function add(sKey: Index, dKey: Index, mapper?: SelectorFn, group?: Accumulator | true) {
    if (cpl === undefined) {
      const d = isString(dKey) ? compiler().object() : compiler().array();
      cpl = isString(sKey) ? d.from.object() : d.from.array();
    }

    if (group) grouped = true;
    const groupFn = group === true ? undefined : group;
    return cpl.builder.add(sKey, dKey, mapper, groupFn);
  }

  function exclude(dKey: Index) {
    if (cpl === undefined) {
      cpl = isString(dKey) ? compiler().object().from.object() : compiler().array().from.array();
    }
    return cpl.builder.exclude(dKey);
  }

  function compile() {
    if (cpl === undefined) {
      cpl = compiler().object().from.object();
    }
    return cpl.compile();
  }

  function selectAll(mapper?: SelectorFn) {
    all = { mapper: mapper };
  }

  function filter(p: PredicateFn) {
    predicate = p;
  }

  return { add: add, exclude: exclude, compile: compile, selectAll: selectAll, filter: filter };
}

function objectGet(src: ObjectData, key: string) {
  return src[key];
}

function arrayGet(src: ArrayData, idx: number) {
  return idx < 0 ? src[src.length + idx] : src[idx];
}

function objectWriter<S extends Index>(query: FieldQuery<S, string>) {
  const { fields } = query;
  function terminal(src: TerminalData): Data {
    if (fields.length === 0) {
      return src;
    }

    const dest: ObjectData = {};
    fields.forEach((f) => (dest[f.dKey] = f.mapper ? f.mapper(src) ?? null : src));
    return dest;
  }

  function object(src: ArrayOrObject<S>) {
    const dest: ObjectData = {};
    for (let i = 0; i < fields.length; i++) {
      const { sKey, dKey, mapper } = fields[i];
      let value = (<any>src)[sKey];
      if (mapper != null) {
        value = mapper(value);
      }

      if (value === undefined) {
        return undefined;
      }

      dest[dKey] = value;
    }

    return dest;
  }

  return <[typeof terminal, typeof object]>[terminal, object];
}

function arrayWriter<S extends Index>(query: FieldQuery<S, number>, getter: (src: ArrayOrObject<S>, s: S) => Data) {
  const { fields, selectAll } = query;

  const readers: (undefined | { sKey: S; mapper?: SelectorFn })[] = [];
  fields.filter((v) => v.dKey >= 0).forEach((p) => (readers[p.dKey] = p));
  const requiredLength = readers.length;

  const negative = fields.filter((v) => v.dKey < 0).sort((a, b) => b.dKey - a.dKey);
  for (let i = 0, j = 0; i < negative.length; i++) {
    while (readers[j] !== undefined) j++;
    readers[j] = negative[i];
  }

  function terminalFn(src: TerminalData) {
    const dest: ArrayData = [];
    for (let dKey = 0; dKey < readers.length; dKey++) {
      // TODO map
      dest[dKey] = readers[dKey] ? src : null;
    }
    return dest;
  }

  function arrayFn(src: ArrayOrObject<S>) {
    const dest: ArrayData = [];
    for (let dKey = 0; dKey < readers.length; dKey++) {
      let value;

      const r = readers[dKey];
      if (r === undefined) {
        if (selectAll && Array.isArray(src) && !selectAll.except.has(dKey)) {
          value = src[dKey];
        }
      } else {
        const { sKey, mapper } = r;
        value = getter(src, sKey);
        if (value !== undefined && mapper !== undefined) {
          value = mapper(value);
        }
      }

      if (dKey < requiredLength) {
        dest[dKey] = value ?? null;
      } else if (value !== undefined) {
        dest.push(value);
      }
    }

    if (selectAll && Array.isArray(src)) {
      //TODO
    }
    return dest;
  }

  return <[typeof terminalFn, typeof arrayFn]>[terminalFn, arrayFn];
}

function groupObjects(groupBy: string[], aggregate: { key: string; fn: Accumulator }[], data: ArrayData) {
  const map = new Map<string, { values: ObjectData; aggs: ReturnType<Accumulator>[] }>();

  data.forEach((d) => {
    if (d == null || Array.isArray(d) || isTerminal(d)) {
      throw Error('NYI');
    }

    const groupValues = groupBy.map((g) => d[g]);
    const groupId = groupValues.toString();
    let groupData = map.get(groupId);
    if (groupData === undefined) {
      const values = groupBy.reduce((p, c, i) => {
        p[c] = groupValues[i];
        return p;
      }, <ObjectData>{});

      groupData = { values: values, aggs: aggregate.map(({ fn }) => fn()) };
      map.set(groupId, groupData);
    }
    const aggs = groupData.aggs;
    aggregate.forEach(({ key }, i) => aggs[i].add(d[key]));
  });

  map.forEach(({ values, aggs }) => aggregate.forEach(({ key }, i) => (values[key] = aggs[i].get())));

  const result: ObjectData[] = [];
  map.forEach(({ values }) => result.push(values));
  return result;
}

function objectReader(
  query: FieldQuery<string, unknown>,
  tFn: (src: TerminalData) => Data | undefined,
  oFn: (src: ObjectData) => Data | undefined
): SelectorFn {
  const { filter, groups } = query;
  const fn: SelectorFn = (src: Data) => {
    if (Array.isArray(src)) {
      const aDest: Data[] = [];

      src.forEach((s) => {
        const v = fn(s);
        if (v !== undefined) {
          aDest.push(v);
        }
      });

      // TODO multi-level arrays
      if (groups) {
        return groupObjects(groups.groupBy, groups.aggregate, aDest);
      }

      return aDest;
    }

    if (filter && !filter(src)) {
      return undefined;
    }

    if (isTerminal(src)) {
      return tFn(src);
    }

    return oFn(src);
  };
  return fn;
}

function arrayReader<D extends Index>(
  query: FieldQuery<number, D>,
  tFn: (src: TerminalData) => Data | undefined,
  aFn: (src: ArrayData) => Data | undefined
): SelectorFn {
  const predicate = query.filter;

  return (src: Data) => {
    if (isTerminal(src)) {
      return tFn(src);
    }
    let aSrc = Array.isArray(src) ? src : src == null ? [] : [src];
    if (predicate && !predicate(src)) {
      return undefined;
    }
    return aFn(aSrc);
  };
}

export class DefaultSelectorResolver {
  predicateResolver = new DefaultPredicateResolver();

  resolveAggregator(name: string): Accumulator | true {
    if (name === 'sum') {
      return () => {
        let v = 0;
        return { add: (a: any) => (v += a), get: () => v };
      };
    }

    if (name === 'values') {
      return () => {
        let v: ArrayData = [];
        return { add: (a: Data) => v.push(a), get: () => v };
      };
    }

    if (name === 'group') {
      return true;
    }

    //TODO
    throw new Error('Method not implemented.');
  }

  resolveFunction(name: string): ResolvedFunction | null {
    //TODO
    if (name === 'abs') {
      return { fn: Math.abs };
    }
    if (name === 'uppercase') {
      return { fn: (v: string) => v.toUpperCase() };
    }

    return null;
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

  compilePredicate(p: Predicate) {
    return this.predicateResolver.compile(p);
  }
}

class CompileLogger {
  multipleWrites(k: unknown): false {
    console.warn('Multiple writes: ', k);
    return false;
  }

  incompatibleTypes(m: string): false {
    console.warn(`Incompatible types, ignoring: ${m}`);
    return false;
  }
}
