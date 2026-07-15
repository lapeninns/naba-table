export function createUnimplementedServiceMethod<
  Method extends (...args: never[]) => Promise<unknown>,
>(
  serviceName: string,
  methodName: string,
): (...args: Parameters<Method>) => Promise<Awaited<ReturnType<Method>>> {
  return async (..._args: Parameters<Method>): Promise<Awaited<ReturnType<Method>>> => {
    throw new Error(`[dev][${serviceName}] ${methodName} is not implemented`);
  };
}
