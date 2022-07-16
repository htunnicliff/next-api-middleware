import { Middleware } from "./types";
import { label } from "./label";

describe("label", () => {
  it("throws an error for invalid middleware", () => {
    // @ts-expect-error
    expect(() => label({ notMiddleware: NaN })).toThrowError();
  });

  it("calls labeled middleware in order", async () => {
    const log: string[] = [];

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

    const withMiddleware = label({
      one: middleware1,
      two: middleware2,
      three: middleware3,
      sampleGroup: [groupMiddleware1, groupMiddleware2],
    });

    const handler = jest.fn();

    await withMiddleware("sampleGroup", "two")(handler)({} as any, {} as any);

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

    const middlewareWithDefaults = label(
      {
        m1: middleware1,
      },
      ["m1"]
    );

    const handler = jest.fn();

    await middlewareWithDefaults()(handler)({} as any, {} as any);

    expect(middleware1).toBeCalled();
    expect(handler).toBeCalled();
  });

  it("throws errors for invalid middleware", async () => {
    const middleware = label({
      normal: (req, res, next) => next(),
    });

    expect(() => middleware("normal", [(a, b) => {}])).toThrowError(
      "Invalid middleware"
    );

    expect(() => middleware("normal", (a, b) => {})).toThrowError(
      "Invalid middleware"
    );

    // @ts-expect-error
    expect(() => middleware("missing")).toThrowError(
      'Middleware "missing" not available'
    );
  });

  it("adds groups to final executed middleware", async () => {
    const m0: Middleware = jest.fn((req, res, next) => next());
    const m1: Middleware = jest.fn((req, res, next) => next());
    const m2: Middleware = jest.fn((req, res, next) => next());

    const middleware = label({
      m0,
    });

    await middleware([m1, m2], "m0")(jest.fn())({} as any, {} as any);
    expect(m1).toBeCalled();
    expect(m2).toBeCalled();
    expect(m0).toBeCalled();
  });

  it("executes inline middleware", async () => {
    const middleware = label({});

    const inlineFn = jest.fn((req, res, next) => next());

    await middleware(inlineFn, inlineFn, inlineFn)(jest.fn())(
      {} as any,
      {} as any
    );

    expect(inlineFn).toBeCalledTimes(3);
  });
});
