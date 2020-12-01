import {
  hasMiddlewareSignature,
  use,
  named,
  makeMiddlewareExecutor,
} from "./index";

describe("hasMiddlewareSignature", () => {
  it("returns false for invalid input", () => {
    expect(hasMiddlewareSignature(NaN)).toBe(false);
    expect(hasMiddlewareSignature(0)).toBe(false);
    expect(hasMiddlewareSignature({})).toBe(false);
    expect(hasMiddlewareSignature(Function)).toBe(false);
    expect(hasMiddlewareSignature([])).toBe(false);
    expect(hasMiddlewareSignature(false)).toBe(false);
    expect(hasMiddlewareSignature(true)).toBe(false);
    expect(hasMiddlewareSignature("")).toBe(false);
    expect(hasMiddlewareSignature((arg1, arg2) => {})).toBe(false);
    expect(hasMiddlewareSignature((arg1, arg2, arg3, arg4) => {})).toBe(false);
  });

  it("returns true for valid input", () => {
    expect(hasMiddlewareSignature((arg1, arg2, arg3) => {})).toBe(true);
  });
});

describe("use", () => {
  it("throws an error for invalid middleware", () => {
    expect(() => use(() => null)).toThrowError();
  });
});

describe("named", () => {
  it("throws an error for invalid middleware", () => {
    // @ts-ignore
    expect(() => named({ notMiddleware: NaN })).toThrowError();
  });

  it("calls named middleware in order", async () => {
    const log = [];

    // Setup middleware
    const middleware1 = jest.fn((req, res, next) => next());
    const middleware2 = jest.fn(async (req, res, next) => {
      log.push("setup middleware2");
      await next();
      log.push("teardown middleware2");
    });
    const middleware3 = jest.fn((req, res, next) => next());
    const groupMiddleware1 = jest.fn(async (req, res, next) => {
      log.push("setup groupMiddleware1");
      await next();
      log.push("teardown groupMiddleware1");
    });
    const groupMiddleware2 = jest.fn(async (req, res, next) => {
      log.push("setup groupMiddleware2");
      await next();
      log.push("teardown groupMiddleware2");
    });

    const useNamed = named({
      one: middleware1,
      two: middleware2,
      three: middleware3,
      sampleGroup: [groupMiddleware1, groupMiddleware2],
    });

    const handler = jest.fn();

    await useNamed("sampleGroup", "two")(handler)({} as any, {} as any);

    expect(middleware2).toBeCalled();
    expect(groupMiddleware1).toBeCalled();
    expect(groupMiddleware2).toBeCalled();
    expect(handler).toBeCalled();
    expect(log.toString()).toBe(
      [
        "setup groupMiddleware1",
        "setup groupMiddleware2",
        "setup middleware2",
        "teardown middleware2",
        "teardown groupMiddleware2",
        "teardown groupMiddleware1",
      ].toString()
    );
  });

  it("calls default middleware", async () => {
    const middleware1 = jest.fn((req, res, next) => next());

    const middlewareWithDefaults = named(
      {
        m1: middleware1,
      },
      { defaults: ["m1"] }
    );

    const handler = jest.fn();

    await middlewareWithDefaults()(handler)({} as any, {} as any);

    expect(middleware1).toBeCalled();
    expect(handler).toBeCalled();
  });
});

describe("makeMiddlewareExecutor", () => {
  it("executes supplied middleware functions in order", async () => {
    const log = [];

    // Make fake middleware
    const middleware1 = jest.fn(async (req, res, next) => {
      log.push("1 setup");
      await next();
      log.push("1 teardown");
    });
    const middleware2 = jest.fn(async (req, res, next) => {
      log.push("2 setup");
      await next();
      log.push("2 teardown");
    });
    const middleware3 = jest.fn((req, res, next) => {
      log.push("3 setup");
      return next();
    });

    const handler = jest.fn((req, res) => {
      log.push("handler");
    });

    // Execute executor (haha)
    await makeMiddlewareExecutor([middleware1, middleware2, middleware3])(
      handler
    )({} as any, {} as any);

    // Make assertions
    expect(middleware1).toBeCalled();
    expect(middleware2).toBeCalled();
    expect(middleware3).toBeCalled();
    expect(handler).toBeCalled();
    expect(log.toString()).toBe(
      [
        "1 setup",
        "2 setup",
        "3 setup",
        "handler",
        "2 teardown",
        "1 teardown",
      ].toString()
    );
  });
});
