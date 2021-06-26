export function isPromise(input: unknown): input is Promise<void> {
  return typeof input === "object" && input !== null && "then" in input;
}

export function controlledPromise() {
  // Set up
  var outsideResolve: () => void;
  var outsideReject: (err: any) => void;

  const promise = new Promise<void>((resolve, reject) => {
    outsideResolve = resolve;
    outsideReject = reject;
  });

  return {
    // @ts-ignore
    unpause: outsideResolve,
    // @ts-ignore
    fail: outsideReject,
    promise,
  };
}
