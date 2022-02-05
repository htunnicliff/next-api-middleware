import { Debugger } from "debug";
import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { Middleware } from "./index.js";
import { logger } from "./logger.js";
import { controlledPromise, isPromise } from "./promises.js";

// This gets invoked internally by `use` and `label`
export function makeMiddlewareExecutor(middlewareFns: Middleware[]) {
  logger("Registered %d middleware functions", middlewareFns.length);

  // This curried function receives an API route
  return function curryApiHandler(apiRouteFn: NextApiHandler): NextApiHandler {
    logger("Registered Next API Handler");

    // The final function returned is a Next API handler that
    // is responsible for executing all the middleware provided,
    // as well as the API route handler
    return async function finalRouteHandler(req, res) {
      logger("Starting middleware execution");
      await new Executor(middlewareFns, apiRouteFn, req, res).run();
    };
  };
}

export class Executor {
  /**
   * The first middleware function in the queue
   */
  currentFn: Middleware;

  /**
   * Middleware remaining in the queue
   */
  remaining: Middleware[];

  /**
   * The return value of `currentFn`
   */
  result?: void | Promise<void>;

  /**
   * A controlled promise that is used to manage
   * the success or failure of this Executor
   */
  internalPromise = controlledPromise();
  succeed = this.internalPromise.resolve;
  fail = this.internalPromise.reject;

  /**
   * A controlled promise that is used to
   * "pause" async middleware from completing until
   * the rest of the `remaining` queue is executed
   */
  teardownPromise = controlledPromise();

  /**
   * Utility for logging debug messages
   */
  log: Debugger;

  /**
   * Integer representing the position of the executor in
   * the "stack" of all middleware, starting at `1`
   */
  stackPosition: number;

  constructor(
    [currentFn, ...remaining]: Middleware[],
    public apiRouteFn: NextApiHandler,
    public req: NextApiRequest,
    public res: NextApiResponse,
    previousStackPosition?: number
  ) {
    this.currentFn = currentFn;
    this.remaining = remaining;
    this.stackPosition = 1 + (previousStackPosition || 0);
    this.log = this.createLog();
  }

  /**
   * Create debug log instance for the executor
   */
  createLog() {
    let log = logger;

    if (this.req?.url) {
      log = logger.extend(this.req.url);
    }

    return log.extend(`fn-${this.stackPosition}`);
  }

  /**
   * Execute the current middleware function.
   *
   * If it fails, the remaining middleware and API route
   * handler are not executed and the error is thrown up.
   *
   * If it succeeds, an executor is created to handle
   * the remaining middleware.
   */
  async run(): Promise<void> {
    const l = this.log;

    try {
      const cleanupPromise = controlledPromise();

      // Call the current function
      l(`Executing middleware "${this.currentFn.name}" 🔵`);
      this.result = this.currentFn(this.req, this.res, (error?: any) => {
        cleanupPromise.resolve();
        l("Finished cleanup");

        // Look for errors from synchronous middleware
        if (error) {
          // Throw errors to be caught in the try/catch block
          throw error;
        }

        // Return teardown promise to "pause" async middleware
        return this.teardownPromise.promise;
      });

      let asyncMiddlewareFailed = false;

      // Add handlers to async middleware, if available
      if (isPromise(this.result)) {
        this.result.then(
          () => {
            l("Async middleware succeeded ✅");
            this.succeed();
          },
          (err) => {
            l("Async middleware failed 🔴");
            asyncMiddlewareFailed = true;
            cleanupPromise.resolve();
            this.fail(err);
          }
        );
      }

      await cleanupPromise.promise;

      // Use a microtask to give async middleware a chance to fail
      queueMicrotask(() => {
        if (!asyncMiddlewareFailed) {
          // Things look good so far – execute the rest of the queue
          this.runRemaining();
        }
      });
    } catch (err) {
      // Catches errors from synchronous middleware
      l("Caught error from synchronous middleware");
      this.fail(err);
    }

    return this.internalPromise.promise;
  }

  /**
   * Execute the remaining middleware, then resume the result
   * promise if it is available.
   */
  async runRemaining(): Promise<void> {
    const l = this.log;

    try {
      if (this.remaining.length === 0) {
        // No more middleware, execute the API route handler
        l("Executing API handler ⚪️");
        await this.apiRouteFn(this.req, this.res);
        l("Finished executing API handler");
      } else {
        // Recursively execute remaining middleware
        const remainingExecutor = new Executor(
          this.remaining,
          this.apiRouteFn,
          this.req,
          this.res,
          this.stackPosition
        );

        l("Running next executor");
        await remainingExecutor.run();
      }

      // The remaining queue is now empty
      this.finish();
    } catch (err) {
      this.finish(err);
    }
  }

  /**
   * Ensure this executor finishes by handling errors
   * correctly, resuming async middleware (if the current
   * middleware is async), or resolving the internal
   * promise as a success.
   */
  finish(error?: any) {
    const l = this.log;
    l("Finishing...");

    if (isPromise(this.result)) {
      // Current middleware is async
      if (error) {
        // Let the result have a chance to handle the error
        l("Passing nested error to async middleware");
        this.teardownPromise.reject(error);
      } else {
        // Let the result continue its teardown
        l("Starting async middleware teardown");
        this.teardownPromise.resolve();
      }
    } else {
      // Current middleware is synchronous
      if (error) {
        // Synchronous middleware cannot handle errors,
        // trigger a failure
        l("Failing executor and passing error up 🔴");
        this.fail(error);
      } else {
        // Synchronous middleware has no teardown phase,
        // trigger a success
        l("Synchronous middleware succeeded ✅");
        this.succeed();
      }
    }
  }
}
