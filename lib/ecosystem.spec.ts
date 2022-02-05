import { ExpressMiddleware, use } from "./index.js";
import cors from "cors";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

describe("cors", () => {
  it("works alongside Next Middleware", async () => {
    expect.assertions(3);

    const middleware = use(async (_req, res, next) => {
      // No CORS headers yet
      expect(res.hasHeader("Access-Control-Allow-Origin")).toBe(false);
      await next();
      // CORS headers applied
      expect(res.getHeader("Access-Control-Allow-Origin")).toBe("*");
    }, cors() as ExpressMiddleware);

    // Create mocks
    const handler = jest.fn(async (_req, res) => {
      // API handler should have CORS headers
      expect(res.getHeader("Access-Control-Allow-Origin")).toBe("*");
    });
    const req = new IncomingMessage(new Socket());
    const res = new ServerResponse(req);

    // Execute middleware with handler
    await middleware(handler)(req as any, res as any);
  });
});
