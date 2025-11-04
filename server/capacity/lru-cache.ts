type Entry<T> = { value: T; expiresAt: number };

type TimerHandle = ReturnType<typeof setInterval> & { unref?: () => void };

export class LruCache<T> {
  private store: Map<string, Entry<T>> = new Map();
  private maxEntries: number;
  private defaultTtlMs: number;
  private scavenger?: TimerHandle;

  constructor(maxEntries: number, defaultTtlMs: number) {
    this.maxEntries = Math.max(1, Math.floor(maxEntries));
    this.defaultTtlMs = Math.max(1, Math.floor(defaultTtlMs));
  }

  get size(): number {
    return this.store.size;
  }

  keys(): IterableIterator<string> {
    return this.store.keys();
  }

  clear(): void {
    this.store.clear();
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  get(key: string): T | null {
    const e = this.store.get(key);
    if (!e) return null;
    const now = Date.now();
    if (e.expiresAt <= now) {
      this.store.delete(key);
      return null;
    }
    // promote to most-recently-used by re-setting
    this.store.delete(key);
    this.store.set(key, e);
    return e.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const now = Date.now();
    const expiresAt = now + (typeof ttlMs === "number" && ttlMs > 0 ? ttlMs : this.defaultTtlMs);
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    this.store.set(key, { value, expiresAt });
    this.evictIfNeeded();
  }

  private evictIfNeeded(): void {
    // Evict expired first
    const now = Date.now();
    for (const [k, e] of this.store) {
      if (e.expiresAt <= now) {
        this.store.delete(k);
      }
    }

    // Enforce max size (remove least-recently-used: first insertion order)
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next();
      if (oldest.done) break;
      this.store.delete(oldest.value);
    }
  }

  pruneExpired(maxToScan = 256): number {
    const now = Date.now();
    let removed = 0;
    let scanned = 0;
    for (const [k, e] of this.store) {
      if (scanned >= maxToScan) break;
      scanned += 1;
      if (e.expiresAt <= now) {
        this.store.delete(k);
        removed += 1;
      }
    }
    return removed;
  }

  startScavenger(intervalMs: number): void {
    const iv = Math.max(1000, Math.floor(intervalMs));
    if (this.scavenger) clearInterval(this.scavenger);
    this.scavenger = setInterval(() => {
      try {
        this.pruneExpired();
      } catch {
        // no-op
      }
    }, iv);
    // Avoid keeping the event loop alive solely for this timer
    this.scavenger.unref?.();
  }
}
