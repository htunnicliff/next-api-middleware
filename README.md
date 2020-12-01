# Next API Middleware

<p>
  <a aria-label="NPM version" href="https://www.npmjs.com/package/next-api-middleware">
    <img alt="NPM version" src="https://img.shields.io/npm/v/next-api-middleware.svg?style=for-the-badge&labelColor=000000">
  </a>
  <a aria-label="License" href="https://github.com/htunnicliff/next-api-middleware/blob/master/LICENSE.txt">
    <img alt="" src="https://img.shields.io/github/license/htunnicliff/next-api-middleware.svg?style=for-the-badge&labelColor=000000">
  </a>
  <a href="https://github.com/htunnicliff/next-api-middleware/actions">
    <img alt="GitHub tests" src="https://img.shields.io/github/workflow/status/htunnicliff/next-api-middleware/Main?style=for-the-badge&labelColor=000000&label=Tests">
  </a>
<p>

## Introduction

[Next.js API routes](https://nextjs.org/docs/api-routes/introduction) are a ridiculously fun and simple way to add backend functionality to a React app. However, when it comes time to add middleware, there is no easy way to implement it.

The official Next.js docs recommend writing functions [inside your API route handler](https://nextjs.org/docs/api-routes/api-middlewares) :thumbsdown:. This is a huge step backward compared to the clean APIs provided by Express.js or Koa.js.

This library attempts to provide minimal, clean, composable middleware patterns that are both productive and pleasant to use. :tada:

## Quick Start

```js
/* pages/api/hello-world.js */

// (1) Import `use`
import { use } from "next-api-middleware";

// (2) Pass middleware functions as arguments to `use`, in
//     the order they should execute. Don't forget the `next` parameter!
const withMiddleware = use(
  /* Capture errors in Sentry */
  async function (req, res, next) {
    try {
      // Let request continue
      await next();
    } catch (err) {
      // Add request URL to Sentry context
      Sentry.setTag("url", req.url);

      // Capture error in Sentry
      Sentry.captureException(err);
      await Sentry.flush(2000);

      // Send error response
      res.status(500);
      res.json({ error: err.message });
    }
  },
  /* Only allow GET requests */
  function (req, res, next) {
    if (req.method === "GET") {
      // Let GET requests continue
      return next();
    } else {
      // Send not found
      res.status(404);
      res.send("Not found");
    }
  },
  /* Load and destroy a database connection */
  async function (req, res, next) {
    // Load database before request
    req.local.db = await loadYourDatabase();

    // Let request continue
    await next();

    // Clean up database after request
    await req.local.database.destroy();
  }
);

/* API route handler */
const apiRouteHandler = async (req, res) => {
  res.status(200);
  res.send("Hello, world!");
};

// (3) Apply the middleware to the API route handler
export default withMiddleware(apiRouteHandler);
```

## Usage

### :one: Create Middleware Functions

```ts
/* lib/middleware/helpers.js */
import type { Middleware } from "next-api-middleware";

/**
 * Add a unique ID to response headers
 */
export const addRequestUUID: Middleware = (req, res, next) => {
  res.setHeader("X-Response-ID", uuid());
  return next();
};

/**
 * Add request start and end times to response headers
 */
export const addRequestTiming: Middleware = async (req, res, next) => {
  res.setHeader("X-Timing-Start", new Date().getTime());
  await next();
  res.setHeader("X-Timing-End", new Date().getTime());
};

/**
 * Log errors to ACME error monitoring service
 */
export const logErrorsWithACME: Middleware = async (req, res, next) => {
  try {
    await next();
  } catch (error) {
    Acme.captureException(error);
    res.status(500);
    res.json({ error: error.message });
  }
};
```

Let's walk through each of these functions to better understand what happens when they are used with an API route.

| Function                | Work before request          | Work after request                                                                   | Explaination                                                                                                                              |
| ----------------------- | ---------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **`addRequestUUID`**    | Add a header with a UUID     | _None_                                                                               | This function only does work _before_ the request, so it doesn't need to use `await`.                                                     |
| **`addRequestTiming`**  | Add a header with start time | Add a header with end time                                                           | This function does work before _and_ after the request, so it uses `await` to let the request continue before finally adding an end time. |
| **`logErrorsWithACME`** | _None_                       | If an error is caught, log and respond with an error message – otherwise, do nothing | This function lets the request proceed immediately, but is able to catch errors that bubble up using its try/catch block.                 |

**Note: Always `return` or `await` the \`next\` function, otherwise requests will time out.**

### :two: Compose Reusable Groups

```js
/* lib/middleware/groups.js */
import { use } from "next-api-middleware";
import {
  addRequestTiming,
  logErrorsWithACME,
  addRequestUUID,
} from "../helpers";
import { connectDatabase, loadUsers } from "../users";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Middleware for guest-accessible routes
 */
export const useGuestMiddleware = use(
  isProduction ? [addRequestTiming, logErrorsWithACME] : []
);

/**
 * Middleware for user-accessible routes
 */
export const useAuthMiddleware = use(
  isProduction ? [addRequestTiming, logErrorsWithACME] : [],
  addRequestUUID,
  connectDatabase,
  loadUsers
);
```

The `use` function creates a higher order function (HOC) that can be used to apply a group of middleware to an API route (see section #3 for more info). `use` accepts a list of values that evaluate to middleware functions.

It also accepts arrays of middleware functions, which makes it trivial to add certain middleware conditionally. In both `useGuestMiddleware` and `useAuthMiddleware`, the `isProduction` variable determined whether or not the request timing and error tracking middleware are included.

### :three: Apply Middleware to API Routes

To apply a middleware group to an API route, just import it and provide the API route handler as an argument:

```js
// pages/api/hello-world.js
import { withGuestMiddleware } from "../../middleware/groups";

const apiHandler = async (req, res) => {
  res.status(200);
  res.send("Hello, world!");
};

export default withGuestMiddleware(apiHandler);
```

## Advanced

### Middleware Factories

Since `use` accepts values that _evaluate_ to middleware functions, this provides the opportunity to create custom middleware factories: functions that create middleware.

Here's an example of a factory that generates a middleware function to only allow requests with a given HTTP method:

```js
import { use } from "next-api-middleware";

/**
 * Return 404 for invalid request methods
 */
export const httpMethod = (allowedHttpMethod) => {
  return async function (req, res, next) {
    if (req.method === allowedHttpMethod || req.method == "OPTIONS") {
      // If method is allowed, let request continue
      await next();
    } else {
      // Otherwise, finish the request and respond with a 404
      res.status(404);
      res.end();
    }
  };
};

export const withAuthMiddleware = use(
  httpMethod("POST"), // only allows POST requests
  addRequestTiming,
  logErrorsWithACME,
  addRequestUUID
);
```
