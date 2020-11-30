## Next API Middleware

Koa-inspired middleware for Next.js API routes.

### Install

```
npm install next-api-middleware
```

### Usage

#### `wrap`
```js
/* /pages/api/hello.js */
import { wrap } from "next-api-middleware";

const handler = async (req, res) => {
  res.status(200);
  res.send("Hello, world!");
};

export default wrap(handler, [
  allowRequestMethods("POST", "PATCH"),
  catchSentryErrors,
  addRequestId,
  loadDatabaseConnections,
]);
```


#### `makeWrap`

```js
// ./middleware/my-wrap.js
import { makeWrap } from "next-api-middleware";

export const myReusableWrap = makeWrap(
  allowRequestMethods("POST", "PATCH"),
  catchSentryErrors,
  addRequestId,
  loadDatabaseConnections,
);

// ./pages/api/hello.js
import { myReusableWrap } from "../../middleware/my-wrap.js";

const handler = async (req, res) => {
  res.status(200);
  res.send("Hello, world!");
};

export default myReusableWrap(handler);
```


