import { makeMiddlewareExecutor } from "./executor";

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
      log.push("3 express-style middleware setup");
      next();
    });
    const middleware4 = jest.fn((req, res, next) => {
      log.push("4 setup");
      return next();
    });

    const handler = jest.fn((req, res) => {
      log.push("handler");
    });

    // Execute executor (haha)
    await makeMiddlewareExecutor([
      middleware1,
      middleware2,
      middleware3,
      middleware4,
    ])(handler)({} as any, {} as any);

    // Make assertions
    expect(middleware1).toBeCalled();
    expect(middleware2).toBeCalled();
    expect(middleware3).toBeCalled();
    expect(handler).toBeCalled();
    expect(log.toString()).toBe(
      [
        "1 setup",
        "2 setup",
        "3 express-style middleware setup",
        "4 setup",
        "handler",
        "2 teardown",
        "1 teardown",
      ].toString()
    );
  });
});
