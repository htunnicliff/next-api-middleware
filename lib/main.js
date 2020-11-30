const middleware = {
  web: [],
  guest: [],
  admin: [],
};

const handler = (req, res) => {
  res.send("Hello, world!");
};

export default use("sentry", "web", "guard", "something")(handler);
