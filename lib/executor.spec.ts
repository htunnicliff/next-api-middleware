import "jest-extended";
import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { Middleware } from ".";
import { makeMiddlewareExecutor } from "./executor";

async function callExecutor(executor: NextApiHandler) {
  const req = {} as NextApiRequest;
  const res = {} as NextApiResponse;

  return executor(req, res);
}

describe("makeMiddlewareExecutor", () => {
  describe("Execution order", () => {
    it("invokes callback-style middleware in order", async () => {
      const [cb1, cb2, cb3] = new Array(3).fill(null).map(() =>
        jest.fn((_req, _res, next) => {
          next();
        })
      );

      const handler = jest.fn(async (_, __) => {});

      await callExecutor(makeMiddlewareExecutor([cb1, cb2, cb3])(handler));

      expect(cb1).toHaveBeenCalledBefore(cb2);
      expect(cb2).toHaveBeenCalledAfter(cb1);
      expect(cb3).toHaveBeenCalledAfter(cb2);
      expect(handler).toHaveBeenCalledAfter(cb3);
    });

    it("invokes async middleware in order", async () => {
      const [a1, a2, a3] = new Array(3).fill(null).map(() =>
        jest.fn(async (_req, _res, next) => {
          await next();
        })
      );

      const handler = jest.fn(async (_, __) => {});

      await callExecutor(makeMiddlewareExecutor([a1, a2, a3])(handler));

      expect(a1).toHaveBeenCalledBefore(a2);
      expect(a2).toHaveBeenCalledAfter(a1);
      expect(a3).toHaveBeenCalledAfter(a2);
      expect(handler).toHaveBeenCalledAfter(a3);
    });

    it("invokes a combination of callback-style and async middleware in the correct order", async () => {
      const [cb1, cb2, cb3] = new Array(3).fill(null).map(() =>
        jest.fn((_req, _res, next) => {
          next();
        })
      );

      const [a1, a2, a3] = new Array(3).fill(null).map(() =>
        jest.fn(async (_req, _res, next) => {
          await next();
        })
      );

      const handler = jest.fn(async (_, __) => {});

      await callExecutor(
        makeMiddlewareExecutor([cb1, a1, cb2, a2, cb3, a3])(handler)
      );

      expect(cb1).toHaveBeenCalledBefore(a1);
      expect(a1).toHaveBeenCalledAfter(cb1);
      expect(cb2).toHaveBeenCalledAfter(a1);
      expect(a2).toHaveBeenCalledAfter(cb2);
      expect(cb3).toHaveBeenCalledAfter(a2);
      expect(a3).toHaveBeenCalledAfter(cb3);
      expect(handler).toHaveBeenCalledAfter(a3);
    });
  });

  describe("Setup and teardown", () => {
    it("invokes callback-style setups, async setups, and async teardowns correctly", async () => {
      const [setup1, setup2, setup3, setup4, teardown1, teardown2] = new Array(
        6
      )
        .fill(null)
        .map(() => jest.fn());

      const handler = jest.fn(async (_, __) => {});

      const nestedWaiting1 = jest.fn();
      const nestedWaiting2 = jest.fn();

      const middleware: Middleware[] = [
        (_, __, next) => {
          setup1();
          next();
        },
        (_, __, next) => {
          setup2();
          next();
        },
        async (_, __, next) => {
          setup3();
          await new Promise<void>((resolve) => {
            setTimeout(() => {
              nestedWaiting1();
              resolve();
            }, 500);
          });
          await next();
          teardown2();
        },
        (_, __, next) => {
          setup4();
          next();
        },
        async (_, __, next) => {
          await next();
          teardown1();
          await new Promise<void>((resolve) => {
            setTimeout(() => {
              nestedWaiting2();
              resolve();
            }, 500);
          });
        },
      ];

      await callExecutor(makeMiddlewareExecutor(middleware)(handler));

      expect(setup1).toHaveBeenCalledBefore(setup2);
      expect(setup3).toHaveBeenCalledAfter(setup2);
      expect(setup4).toHaveBeenCalledAfter(setup3);
      expect(setup4).toHaveBeenCalledAfter(nestedWaiting1);
      expect(handler).toHaveBeenCalledAfter(setup4);
      expect(teardown1).toHaveBeenCalledAfter(handler);
      expect(teardown2).toHaveBeenCalledAfter(nestedWaiting2);
      expect(teardown2).toHaveBeenCalledAfter(teardown1);
    });
  });

  describe("Error handling", () => {
    it("prevents further middleware and handler execution when callback-style middleware fails", async () => {
      const [cb1, cb2, cb3] = new Array(3).fill(null).map(() =>
        jest.fn((_req, _res, next) => {
          next();
        })
      );

      const cbFailing = jest.fn((_req, _res, next) => {
        next(new Error("Failure"));
      });

      const [a1, a2, a3] = new Array(3).fill(null).map(() =>
        jest.fn(async (_req, _res, next) => {
          await next();
        })
      );

      const handler = jest.fn(async (_, __) => {});

      expect(
        callExecutor(
          makeMiddlewareExecutor([cb1, a1, cb2, cbFailing, a2, cb3, a3])(
            handler
          )
        )
      ).toReject();

      expect(cb1).toHaveBeenCalledBefore(a1);
      expect(a1).toHaveBeenCalledAfter(cb1);
      expect(cb2).toHaveBeenCalledAfter(a1);
      expect(cbFailing).toHaveBeenCalledAfter(cb2);
      expect(a2).not.toHaveBeenCalled();
      expect(cb3).not.toHaveBeenCalled();
      expect(a3).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });

    it("prevents further middleware and handler execution when async middleware fails", async () => {
      const [cb1, cb2, cb3] = new Array(3).fill(null).map(() =>
        jest.fn((_req, _res, next) => {
          next();
        })
      );

      const aFailing = jest.fn(async (_req, _res, next) => {
        throw new Error("Failed");
      });

      const [a1, a2, a3] = new Array(3).fill(null).map(() =>
        jest.fn(async (_req, _res, next) => {
          await next();
        })
      );

      const handler = jest.fn(async (_, __) => {});

      expect(
        callExecutor(
          makeMiddlewareExecutor([cb1, a1, cb2, aFailing, a2, cb3, a3])(handler)
        )
      ).toReject();

      expect(cb1).toHaveBeenCalledBefore(a1);
      expect(a1).toHaveBeenCalledAfter(cb1);
      expect(cb2).toHaveBeenCalledAfter(a1);
      expect(aFailing).toHaveBeenCalledAfter(cb2);
      expect(a2).not.toHaveBeenCalled();
      expect(cb3).not.toHaveBeenCalled();
      expect(a3).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });

    it("prevents further middleware and handler execution when async middleware fails using soley async middleware", async () => {
      const aFailing = jest.fn(async (_req, _res, _next) => {
        throw new Error("Failed");
      });

      const [a1, a2, a3] = new Array(3).fill(null).map(() =>
        jest.fn(async (_req, _res, next) => {
          await next();
        })
      );

      const handler = jest.fn(async (_, __) => {});

      expect(
        callExecutor(makeMiddlewareExecutor([a1, a2, aFailing, a3])(handler))
      ).toReject();

      expect(a1).toHaveBeenCalledBefore(a2);
      expect(a2).toHaveBeenCalledAfter(a1);
      expect(aFailing).toHaveBeenCalledAfter(a2);
      expect(a3).not.toBeCalled();
      expect(handler).not.toBeCalled();
    });

    it("enables async middleware to capture errors", async () => {
      const aFailing = jest.fn(async (_req, _res, _next) => {
        throw new Error("Failed");
      });

      const caughtError = jest.fn();

      const aErrorHandler = jest.fn(async (_req, _res, next) => {
        try {
          await next();
        } catch (err) {
          caughtError(err);
        }
      });

      const [a1, a2, a3] = new Array(3).fill(null).map(() =>
        jest.fn(async (_req, _res, next) => {
          await next();
        })
      );

      const handler = jest.fn(async (_, __) => {});

      await callExecutor(
        makeMiddlewareExecutor([a1, a2, aErrorHandler, a3, aFailing])(handler)
      );

      expect(a1).toHaveBeenCalledBefore(a2);
      expect(a2).toHaveBeenCalledAfter(a1);
      expect(aErrorHandler).toHaveBeenCalledAfter(a2);
      expect(a3).toHaveBeenCalledAfter(aErrorHandler);
      expect(aFailing).toHaveBeenCalledAfter(a3);
      expect(handler).not.toBeCalled();
      expect(caughtError).toBeCalled();
    });
  });
});
