type Flush = () => Promise<void>;

const flushers = new Set<Flush>();

/** Registers a flush hook; returns an unregister function. */
export function registerFlush(fn: Flush): () => void {
  flushers.add(fn);
  return () => {
    flushers.delete(fn);
  };
}

/** Runs every hook; never rejects. */
export async function flushAll(): Promise<void> {
  await Promise.allSettled([...flushers].map((fn) => fn()));
}
