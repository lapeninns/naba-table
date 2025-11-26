export function debounce<TArgs extends unknown[]>(fn: (...args: TArgs) => void, wait: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: TArgs): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
}

export function throttle<TArgs extends unknown[]>(fn: (...args: TArgs) => void, wait: number) {
  let last = 0;
  return (...args: TArgs): void => {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn(...args);
    }
  };
}

export function debouncePromise<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  wait: number,
) {
  const debounced = debounce((...args: TArgs) => {
    void fn(...args);
  }, wait);
  return (...args: TArgs): void => debounced(...args);
}
