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

_**Warning: This library is in alpha, so APIs may change at any time.**_

## Introduction

Next.js API routes are a ridiculously fun and simple way to add backend functionality to a React app. However, when it comes time to add middleware, there are no easy ways to implement it. The official Next.js docs recommend just running middleware as functions within your API route. This is a huge step backward compared to the clean APIs provided by Express.js or Koa.js.

This library is an attempt to provide Next.js applications with clean, composable middleware patterns inspired by Koa.js.

## Quick Start

```js
import { use } from "next-api-middleware";

const addTimingHeaders = async (req, res, next) => {
  res.setHeader("X-Timing-Start", new Date().getTime());
  await next();
  res.setHeader("X-Timing-End", new Date().getTime());
};

const loadUser = (req, res, next) => {
  req.locals.user = {
    name: req.query.name || "Oswald",
    age: req.query.age || 42,
  };

  return next();
};

const apiHandler = async (req, res) => {
  const { user } = req.locals;
  res.status(200);
  res.send(`${user.name} is ${user.age} old!`);
};

export default use(addTimingHeaders, loadUser)(apiHandler);
```

Here's a breakdown of what's happening:

0. A GET request hits this API route.
1. addTimingHeaders (middleware) sets the X-Timing-Start header.
2. loadUser (middleware) sets the value of req.locals.user.
3. apiHandler (API route handler) sends a response.
4. addTimingHeaders sets the X-Timing-End header.
5. The request completes.

## Usage

### 1. Create Middleware Functions

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

### 2. Compose Reusable Groups with `use`

```js
/* lib/middleware/groups.js */
import {
  addRequestTiming,
  logErrorsWithACME,
  addRequestUUID,
} from "../helpers";
import { connectDatabase, loadUsers } from "../users";
import { use } from "next-api-middleware";

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

#### Middleware Factories

Since `use` accepts values that _evaluate_ to middleware functions, this provides the opportunity to create custom middleware factories, e.g. functions that create middleware. Here's an example of a factory that generates middleware to only allow requests with a given HTTP method:

```ts
import { use, Middleware } from "next-api-middleware";

/**
 * Return 404 for invalid request methods.
 */
export const httpMethod = (
  allowedHttpMethod: "GET" | "POST" | "PUT" | "PATCH"
): Middleware => {
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
  httpMethod("POST"), // only allow POST requests
  addRequestTiming,
  logErrorsWithACME,
  addRequestUUID
);
```

### 3. Apply Middleware to API routes

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
