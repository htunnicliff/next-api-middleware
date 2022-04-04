import { use } from "./use";

describe("use", () => {
  it("throws an error for invalid middleware", () => {
    expect(() => use(() => null)).toThrowError();
  });

  it("resolves with the middleware response if middleware bypasses handler", async () => {
    const apiHandler = () => {
      return Promise.resolve('handler response!')
    }

    const middleware = async (req, res, next) => {
      await next();
      return Promise.resolve('middleware response!');
    }

    const wrappedHandler = use(middleware)(apiHandler)

    const result = await wrappedHandler();

    expect(result).toEqual('middleware response!');
  });

  it("rejects with the middleware failure if middleware bypasses handler", async () => {
    const apiHandler = () => {
      return Promise.resolve('handler response!')
    }

    const middleware = async (req, res, next) => {
      await next();
      return Promise.reject('middleware failure!');
    }

    const wrappedHandler = use(middleware)(apiHandler)

    try {
      await wrappedHandler();
    } catch (err) {
      expect(err).toEqual('middleware failure!')
    }
  });

  it("resolves with the handler response if middleware forwards it", async () => {
    const apiHandler = () => {
      return Promise.resolve('handler response!')
    }

    const middleware = async (req, res, next) => {
      return await next();
    }

    const wrappedHandler = use(middleware)(apiHandler)

    const result = await wrappedHandler();

    expect(result).toEqual('handler response!');
  });

  it("rejects with the handler failure if middleware forwards it", async () => {
    const apiHandler = () => {
      return Promise.reject('handler failure!')
    }

    const middleware = async (req, res, next) => {
      return await next();
    }

    const wrappedHandler = use(middleware)(apiHandler)

    try {
      await wrappedHandler();
    } catch (err) {
      expect(err).toEqual('handler failure!')
    }
  });

  it("does not proceed to the next middleware if the first one resolves", async () => {
    const one = jest.fn();
    const two = jest.fn();

    const apiHandler = () => {
      return Promise.resolve('handler response!')
    }

    const middlewareOne = async (req, res, next) => {
      one();
      return Promise.resolve('stop here');
    }

    const middlewareTwo = async (req, res, next) => {
      two();
      return await next();
    }

    const wrappedHandler = use(middlewareOne, middlewareTwo)(apiHandler)

    const result = await wrappedHandler();
    expect(result).toEqual('stop here');
    expect(one).toHaveBeenCalled()
    expect(two).not.toHaveBeenCalled()
  });

  it("does not proceed to the next middleware if the first one rejects", async () => {
    const one = jest.fn();
    const two = jest.fn();

    const apiHandler = () => {
      return Promise.resolve('handler response!')
    }

    const middlewareOne = async (req, res, next) => {
      one();
      return Promise.reject('stop here');
    }

    const middlewareTwo = async (req, res, next) => {
      two();
      return await next();
    }

    const wrappedHandler = use(middlewareOne, middlewareTwo)(apiHandler)

    try {
      await wrappedHandler();
    } catch (err) {
      expect(err).toEqual('stop here')
    }

    expect(one).toHaveBeenCalled()
    expect(two).not.toHaveBeenCalled()
  });
});
