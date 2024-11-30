import { excludeNullish } from "../../util/util.js";
import { describe, it, expect } from "vitest";
describe("excludeNullish", () => {
  it("should exclude null and undefined values", () => {
    const obj = {
      a: 1,
      b: null,
      c: undefined,
      d: "test",
      e: 0,
      f: false,
      g: "",
    };

    const result = excludeNullish(obj);

    expect(result).toEqual({
      a: 1,
      d: "test",
      e: 0,
      f: false,
      g: "",
    });
  });

  it("should handle empty object", () => {
    const obj = {};
    const result = excludeNullish(obj);
    expect(result).toEqual({});
  });

  it("should handle object with no nullish values", () => {
    const obj = {
      a: 1,
      b: "test",
      c: true,
      d: 0,
    };

    const result = excludeNullish(obj);
    expect(result).toEqual(obj);
  });

  it("should handle object with all nullish values", () => {
    const obj = {
      a: null,
      b: undefined,
      c: null,
    };

    const result = excludeNullish(obj);
    expect(result).toEqual({});
  });

  it("should handle nested objects", () => {
    const obj = {
      a: {
        b: null,
        c: 1,
      },
      d: null,
      e: {
        f: undefined,
        g: "test",
      },
    };

    const result = excludeNullish(obj);
    expect(result).toEqual({
      a: {
        b: null,
        c: 1,
      },
      e: {
        f: undefined,
        g: "test",
      },
    });
  });
});
