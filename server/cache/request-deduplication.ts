const pendingRequests = new Map<string, Promise<unknown>>();

export function deduplicate<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = pendingRequests.get(key) as Promise<T> | undefined;
  if (existing) {
    return existing;
  }

  let created: Promise<T>;
  try {
    created = Promise.resolve(factory());
  } catch (error) {
    throw error;
  }

  const tracked = created.finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, tracked);
  return created;
}
