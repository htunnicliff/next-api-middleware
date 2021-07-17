<p align="center">
  <h1 align="center">Next.js API Middleware</h1>
</p>

<p align="center">
  <a aria-label="npm@latest" href="https://www.npmjs.com/package/next-api-middleware">
    <img alt="npm@latest" src="https://img.shields.io/npm/v/next-api-middleware/latest.svg?style=for-the-badge&labelColor=000000">
  </a>
  <a aria-label="npm@canary" href="https://www.npmjs.com/package/next-api-middleware">
    <img alt="npm@canary" src="https://img.shields.io/npm/v/next-api-middleware/canary.svg?style=for-the-badge&labelColor=000000">
  </a>
  <a aria-label="license" href="https://github.com/htunnicliff/next-api-middleware/blob/master/LICENSE">
    <img alt="license" src="https://img.shields.io/github/license/htunnicliff/next-api-middleware.svg?style=for-the-badge&labelColor=000000">
  </a>
</p>
<p align="center">
  <a aria-label="tests" href="https://github.com/htunnicliff/next-api-middleware/actions?query=workflow%3ATest">
    <img alt="tests" src="https://img.shields.io/github/workflow/status/htunnicliff/next-api-middleware/Test?style=for-the-badge&labelColor=000000&label=Tests">
  </a>
  <a aria-label="coverage" href="https://codecov.io/gh/htunnicliff/next-api-middleware/">
    <img alt="Codecov" src="https://img.shields.io/codecov/c/github/htunnicliff/next-api-middleware?style=for-the-badge&labelColor=000000&token=XI7G8L08TY">
  </a>
<p>

## Introduction

[Next.js API routes](https://nextjs.org/docs/api-routes/introduction) are a ridiculously fun and simple way to add backend functionality to a React app. However, when it comes time to add middleware, there is no easy way to implement it.

The official Next.js docs recommend writing functions [inside your API route handler](https://nextjs.org/docs/api-routes/api-middlewares) :thumbsdown:. This is a huge step backward compared to the clean APIs provided by Express.js or Koa.js.

This library attempts to provide minimal, clean, composable middleware patterns that are both productive and pleasant to use. :tada:

## Quick Start

```js
import { use } from "next-api-middleware";
import cors from "cors";

// Create a wrapper function that executes middleware
// before and after an API route request
const withMiddleware = use(
  async (req, res, next) => {
    console.log("Do work before the request");
    await next();
    console.log("Clean up");
  },
  async (req, res, next) => {
    console.log("Do more work");
    await next();
    console.log("Clean up more");
  },
  cors(), // <---- Invoke Express/Connect middleware like any other middleware
  async (req, res, next) => {
    console.log("Store user in request");
    req.locals = {
      user: {
        name: "Alice",
        email: "alice@example.com",
      },
    };

    await next();
  }
);

// Create a normal Next.js API route handler
const apiRouteHandler = async (req, res) => {
  const { name } = req.locals.user;

  res.status(200);
  res.send(`Hello, ${name}!`);
};

// Export the route handler wrapped inside the middleware function
export default withMiddleware(apiRouteHandler);

/**
 * Console output:
 *
 *   Do work before the request
 *   Do more work
 *   cors
 *   Store user in request
 *   Clean up more
 *   Clean up
 */
```

## Usage

### Writing Async Middleware

```ts
import type { NextMiddleware } from "next-api-middleware";

// Middleware that does work before a request
export const addRequestUUID: NextMiddleware = async (req, res, next) => {
  // Set a custom header
  res.setHeader("X-Response-ID", uuid());

  // Execute the remaining middleware
  await next();
};

// Middleware that does work before *and* after a request
export const addRequestTiming: NextMiddleware = async (req, res, next) => {
  // Set a custom header before other middleware and the route handler
  res.setHeader("X-Timing-Start", new Date().getTime());

  // Execute the remaining middleware
  await next();

  // Set a custom header
  res.setHeader("X-Timing-End", new Date().getTime());
};

// Middleware that catches errors that occur in remaining middleware
// and the request
export const logErrorsWithACME: NextMiddleware = async (req, res, next) => {
  try {
    // Catch any errors that are thrown in remaining
    // middleware and the API route handler
    await next();
  } catch (error) {
    Acme.captureException(error);
    res.status(500);
    res.json({ error: error.message });
  }
};
```

### Composing Middleware Groups

```js
import { use } from "next-api-middleware";
import {
  addRequestTiming,
  logErrorsWithACME,
  addRequestUUID,
} from "../helpers";
import { connectDatabase, loadUsers } from "../users";

// Create a middleware wrapper to be used on API routes
// that need authentication
export const withAuthMiddleware = use(
  addRequestTiming,
  logErrorsWithACME,
  addRequestUUID,
  connectDatabase,
  loadUsers
);

// Create a middleware wrapper to be used on API routes
// that are only used by guests
export const withGuestMiddleware = use(
  isProduction ? [addRequestTiming, logErrorsWithACME] : [],
  addRequestUUID
);

// Create a middleware wrapper using arrays of middleware
// functions; these are flattened and executed in the order
// in which they are provided
export const withXYZMiddleware = use(
  [addRequestUUID, connectDatabase, loadUsers],
  [addRequestTiming, logErrorsWithACME]
);
```

The `use` method creates a higher order function that applies middleware to an API route. `use` accepts a list of values that evaluate to middleware functions. It also accepts arrays of middleware functions, which are flattened at runtime (order is preserved).

Another available method for grouping middleware is `label`. Here's how it works:

```ts
import { label } from "next-api-middleware";
import {
  addRequestTiming,
  logErrorsWithACME,
  addRequestUUID,
} from "../helpers";

// Create a middleware wrapper that imports middleware and
// assigns friendly labels
const withMiddleware = label({
  timing: addRequestTiming,
  logErrors: logErrorsWithACME,
  uuids: addRequestUUID,
  all: [addRequestTiming, logErrorsWithACME, addRequestUUID],
});

const apiRouteHandler = async (req, res) => {
  const { name } = req.locals.user;

  res.status(200);
  res.send(`Hello, ${name}!`);
};

// Only invoke `addRequestTiming` and `logErrorsWithACME`, using their
// friendly labels
export default withMiddleware("timing", "logErrors")(apiRouteHandler);
```

Using `label` creates a middleware group that, by default, doesn't invoke any middleware. Instead, it allows choosing specific middleware by supplying labels as arguments in the API route.

## Advanced

### Middleware Factories

Since `use` accepts values that evaluate to middleware functions, this provides the opportunity to create custom middleware factories.

Here's an example of a factory that generates a middleware function to only allow requests with a given HTTP method:

```ts
import { use, NextMiddleware } from "next-api-middleware";

const httpMethod = (
  allowedHttpMethod: "GET" | "POST" | "PATCH"
): NextMiddleware => {
  return async function (req, res, next) {
    if (req.method === allowedHttpMethod || req.method == "OPTIONS") {
      await next();
    } else {
      res.status(404);
      res.end();
    }
  };
};

export const withAuthMiddleware = use(
  httpMethod("POST"),
  addRequestTiming,
  logErrorsWithACME,
  addRequestUUID
);
```

### Middleware Types

`next-api-middleware` supports two middleware signatures, `NextMiddleware` and `ExpressMiddleware`.

#### `NextMiddleware` (preferred)

`NextMiddleware` is inspired by the asyncronous middleware style popularized by Koa.js. Prefer this style when writing your own middleware.

```ts
interface NextMiddleware {
  (
    req: NextApiRequest,
    res: NextApiResponse,
    next: () => Promise<void>
  ): Promise<void>;
}
```

#### `ExpressMiddleware`

`ExpressMiddleware` roughly matches the signature used by Express/Connect style middleware. This type can be used when importing third-party libraries such as `cors`.

```ts
interface ExpressMiddleware<
  Request = IncomingMessage,
  Response = ServerResponse
> {
  (
    req: Request,
    res: Response,
    next: (error?: any) => void | Promise<void>
  ): void;
}
```

An example using `cors`:

```ts
import { use } from "next-api-middleware";
import cors from "cors";

export const withMiddleware = use(
  // Asserting express/connect middleware as an `ExpressMiddleware` interface
  // can resolve type conflicts by libraries that provide their own types.
  cors() as ExpressMiddleware
);
```
