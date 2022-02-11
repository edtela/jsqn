// Copyright 2022 Edvin Tela. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { Data } from './data';
import { AndPredicate, isValuePredicate, NOT_OP, OrPredicate, Predicate } from './predicate';

export type PredicateFn = (v: unknown) => boolean;
export type PredicateCompiler = (p: Predicate, r: PredicateResolver) => PredicateFn;

export interface PredicateResolver {
  compile(p: Predicate): PredicateFn;
  resolveKey(k: string): undefined | PredicateCompiler;
}

export function compilePredicate(p: Predicate, r: PredicateResolver): PredicateFn {
  if (isValuePredicate(p)) {
    return (v: unknown) => v == p;
  }

  if (Array.isArray(p)) {
    return compileOr(p, r);
  }

  return compileAnd(p, r);
}

export function compileAnd(p: AndPredicate, r: PredicateResolver): PredicateFn {
  const andFns: PredicateFn[] = Object.keys(p).map((k) => {
    const resolvedFn = r.resolveKey(k);
    if (resolvedFn != null) {
      return resolvedFn(p[k], r);
    }

    const valueFn = r.compile(p[k]);
    //FIXME
    return (v) => valueFn(v == null ? v : (<any>v)[k]);
  });

  if (andFns.length === 0) {
    return (v) => true;
  }

  if (andFns.length === 1) {
    return andFns[0];
  }

  return (v) => andFns.findIndex((fn) => !fn(v)) < 0;
}

export function compileOr(p: OrPredicate, r: PredicateResolver): PredicateFn {
  const orFns: PredicateFn[] = p.map((or) => {
    if (Array.isArray(or)) {
      throw Error('NYI');
    }
    return r.compile(or);
  });

  if (orFns.length === 0) {
    return (v) => false;
  }

  if (orFns.length === 1) {
    return orFns[0];
  }

  return (v) => orFns.findIndex((fn) => fn(v)) >= 0;
}

export const notCompiler: PredicateCompiler = (p, r) => {
  const fn = r.compile(p);
  return (v) => !fn(v);
};

const regExpCompiler: PredicateCompiler = (p, r) => {
  if (typeof p !== 'string') {
    throw Error('NYI');
  }

  const rx = new RegExp(p);
  return (v: any) => v != null && rx.test(v);
};

const compareCompilers: PredicateCompiler[] = [
  (p: any) => (v: any) => v < p,
  (p: any) => (v: any) => v <= p,
  (p: any) => (v: any) => v >= p,
  (p: any) => (v: any) => v > p,
].map((fn) => (p) => {
  if (typeof p === 'object') {
    throw Error('NYI');
  }
  return fn(p);
});

export class DefaultPredicateResolver implements PredicateResolver {
  protected compilers: { [op: string]: PredicateCompiler } = {};

  constructor(notOp = NOT_OP, compareOps = ['<', '<=', '>=', '>'], regExpOp = '~') {
    this.compilers[notOp] = notCompiler;
    this.compilers[regExpOp] = regExpCompiler;

    compareOps.forEach((op, i) => (this.compilers[op] = compareCompilers[i]));
  }

  compile(p: Predicate): PredicateFn {
    return compilePredicate(p, this);
  }

  resolveKey(k: string): undefined | PredicateCompiler {
    return this.compilers[k];
  }
}
