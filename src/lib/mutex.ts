export class Mutex {
  private queue = Promise.resolve();

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void = () => {};
    const nextPromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    const currentQueue = this.queue;
    this.queue = currentQueue.then(() => nextPromise);

    try {
      await currentQueue;
      return await fn();
    } finally {
      release();
    }
  }
}

const globalForMutex = global as unknown as { mutex: Mutex };

export const checkoutMutex = globalForMutex.mutex || new Mutex();

if (process.env.NODE_ENV !== 'production') globalForMutex.mutex = checkoutMutex;
