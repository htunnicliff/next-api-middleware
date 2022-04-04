import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { controlledPromise, isPromise } from "./promises";
import { Middleware } from "./types";

// This gets invoked internally by `use` and `label`
export function makeMiddlewareExecutor(middlewareFns: Middleware[]) {
  // This curried function receives an API route
  return function curryApiHandler(apiRouteFn: NextApiHandler): NextApiHandler {
    // The final function returned is a Next API handler that
    // is responsible for executing all the middleware provided,
    // as well as the API route handler
    return async function finalRouteHandler(req, res) {
      return await new Executor(middlewareFns, apiRouteFn, req, res).run();
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
  result?: void | Promise<any>;

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
  async run(): Promise<any> {
    try {
      const cleanupPromise = controlledPromise();

      // Call the current function
      this.result = this.currentFn(this.req, this.res, (error?: any) => {
        cleanupPromise.resolve();

        // Look for errors from synchronous middleware
        if (error) {
          // Throw errors to be caught in the try/catch block
          throw error;
        }

        // Return teardown promise to "pause" async middleware
        return this.teardownPromise.promise;
      });

      let asyncMiddlewareDone = false;

      // Add handlers to async middleware, if available
      if (isPromise(this.result)) {
        this.result.then(
          (result: any) => {
            // If the middleware returns something other than undefined,
            // we abort the rest of the promise chain and return
            if (result !== undefined) {
              cleanupPromise.resolve();
              asyncMiddlewareDone = true;
              this.succeed(result);
            }

            this.succeed();
          },
          (err) => {
            asyncMiddlewareDone = true;
            cleanupPromise.resolve();
            this.fail(err);
          }
        );
      }

      await cleanupPromise.promise;

      // Use a microtask to give async middleware a chance to fail
      queueMicrotask(() => {
        if (!asyncMiddlewareDone) {
          // Things look good so far – execute the rest of the queue
          this.runRemaining();
        }
      });
    } catch (err) {
      // Catches errors from synchronous middleware
      this.fail(err);
    }

    return this.internalPromise.promise;
  }

  /**
   * Execute the remaining middleware, then resume the result
   * promise if it is available.
   */
  async runRemaining(): Promise<any> {
    let response;
    try {
      if (this.remaining.length === 0) {
        // No more middleware, execute the API route handler
        response = await this.apiRouteFn(this.req, this.res);
      } else {
        // Recursively execute remaining middleware
        const remainingExecutor = new Executor(
          this.remaining,
          this.apiRouteFn,
          this.req,
          this.res,
          this.stackPosition
        );

        response = await remainingExecutor.run();
      }

      // The remaining queue is now empty
      this.finish(response);
    } catch (err) {
      this.finish(response, err);
    }
  }

  /**
   * Ensure this executor finishes by handling errors
   * correctly, resuming async middleware (if the current
   * middleware is async), or resolving the internal
   * promise as a success.
   */
  finish(response?: any, error?: any) {
    if (isPromise(this.result)) {
      // Current middleware is async
      if (error) {
        // Let the result have a chance to handle the error
        this.teardownPromise.reject(error);
      } else {
        // Let the result continue its teardown
        this.teardownPromise.resolve(response);
      }
    } else {
      // Current middleware is synchronous
      if (error) {
        // Synchronous middleware cannot handle errors, trigger a failure
        this.fail(error);
      } else {
        // Synchronous middleware has no teardown phase, trigger a success
        this.succeed(response);
      }
    }
  }
}
