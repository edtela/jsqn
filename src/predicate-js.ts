// Copyright 2022 Edvin Tela. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { AndPredicate, isValuePredicate, NOT_OP, OrPredicate, Predicate } from "./predicate";

export type PredicateFn = (v: any) => boolean;

export interface PredicateResolver {
  resolveKey(k: string): undefined | ((p: Predicate, r: PredicateResolver) => PredicateFn);
}

export class DefaultPredicateResolver implements PredicateResolver {
  constructor(protected notOp = NOT_OP, protected parent?: PredicateResolver) {}

  resolveKey(k: string): undefined | ((p: Predicate, r: PredicateResolver) => PredicateFn) {
    if (k === this.notOp) {
      return compileNot;
    }

    return this.parent?.resolveKey(k);
  }
}

export const defaultPredicateResolver = new DefaultPredicateResolver();

export function compilePredicate(p: Predicate, r: PredicateResolver = defaultPredicateResolver): PredicateFn {
  if (isValuePredicate(p)) {
    return (v: any) => v == p;
  }

  if (Array.isArray(p)) {
    return compileOr(p, r);
  }

  return compileAnd(p, r);
}

function compileNot(p: Predicate, r: PredicateResolver): PredicateFn {
  const fn = compilePredicate(p, r);
  return (v) => !fn(v);
}

function compileAnd(p: AndPredicate, r: PredicateResolver): PredicateFn {
  const andFns: PredicateFn[] = Object.keys(p).map((k) => {
    const resolvedFn = r.resolveKey(k);
    if (resolvedFn != null) {
      return resolvedFn(p[k], r);
    }

    const valueFn = compilePredicate(p[k], r);
    return (v) => valueFn(v == null ? v : v[k]);
  });

  if (andFns.length === 0) {
    return (v) => true;
  }

  if (andFns.length === 1) {
    return andFns[0];
  }

  return (v) => andFns.findIndex((fn) => !fn(v)) < 0;
}

function compileOr(p: OrPredicate, r: PredicateResolver): PredicateFn {
  const orFns: PredicateFn[] = p.map((or) => {
    if (Array.isArray(or)) {
      throw Error("NYI");
    }
    return compilePredicate(or);
  });

  if (orFns.length === 0) {
    return (v) => false;
  }

  if (orFns.length === 1) {
    return orFns[0];
  }

  return (v) => orFns.findIndex((fn) => fn(v)) >= 0;
}
