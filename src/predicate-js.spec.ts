// Copyright 2022 Edvin Tela. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { Predicate } from "./predicate";
import { compilePredicate, DefaultPredicateResolver } from "./predicate-js";

function compile(p: Predicate) {
  return compilePredicate(p, new DefaultPredicateResolver());
}

describe("NOT predicate", () => {
  const resolver = it("should negate the result of resolver", () => {
    const fn = compile({ "!": 5 });
    expect(fn(5)).toBeFalse();
    expect(fn(6)).toBeTrue();
  });
});

describe("OR predicate", () => {
  it("should produce false when array is empty", () => {
    const fn = compile([]);
    expect(fn(5)).toBeFalse();
  });

  it("should produce false when no predicate matches", () => {
    let fn = compile([4]);
    expect(fn(5)).toBeFalse();

    fn = compile([4, 6]);
    expect(fn(5)).toBeFalse();
  });

  it("should produce true when at least one predicate matches", () => {
    let fn = compile([5]);
    expect(fn(5)).toBeTrue();

    fn = compile([5, 6]);
    expect(fn(5)).toBeTrue();

    fn = compile(["a", "b", "a"]);
    expect(fn("a")).toBeTrue();
  });
});

describe("AND predicate", () => {
  it("should produce false when at least one value doesnt match", () => {
    let fn = compile({ a: 5 });
    expect(fn({ a: 4, b: 6 })).toBeFalse();
    expect(fn({})).toBeFalse();

    fn = compile({ a: { a: 5, b: 6 } });
    expect(fn({ a: { a: 4, b: 6 } })).toBeFalse();
    expect(fn({ a: { b: 6 } })).toBeFalse();
    expect(fn({ a: null })).toBeFalse();
    expect(fn({ a: undefined })).toBeFalse();
  });

  it("should produce true for an empty predicate", () => {
    let fn = compile({});
    expect(fn({ a: 5 })).toBeTrue();
    expect(fn(undefined)).toBeTrue();
    expect(fn(null)).toBeTrue();
  });

  it("should produce false for undefined and null", () => {
    let fn = compile({ a: true });
    expect(fn(undefined)).toBeFalse();
    expect(fn(null)).toBeFalse();
  });

  it("should produce true when all values match", () => {
    let fn = compile({ a: 5 });
    expect(fn({ a: 5 })).toBeTrue();

    fn = compile({ a: 5, b: 6 });
    expect(fn({ a: 5, b: 6, c: 7 })).toBeTrue();
  });
});

describe("compilePredicate", () => {
  it("should produce true when all values match", () => {
    const fn = compile({
      a: {
        a: [5, 7],
        b: 6,
      },
      b: {
        a: [{ "<": 5 }, { ">": 7 }],
        b: {
          "!": [5, 6],
          ">=": 5,
          "<=": 7,
        },
      },
    });

    const v = {
      a: { a: 5, b: 6 },
      b: { a: 3, b: 7 },
    };
    expect(fn(v)).toBeTrue();

    v.b.b = 6;
    expect(fn(v)).toBeFalse();
  });
});
