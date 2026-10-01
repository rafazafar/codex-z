/**
 * Process-wide record of which Host session is running an External Turn for a
 * Thread. Each Desktop connection owns its own AppServerHost, so without this a
 * reconnected session cannot see that a previous session's Turn is still
 * writing to the same native session.
 */
export class ExternalTurnLeases {
  readonly #holders = new Map<string, unknown>();
  readonly #listeners = new Set<(threadId: string) => void>();

  /** Notified after a lease is released. Returns an unsubscribe function. */
  subscribe(listener: (threadId: string) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Returns false when another owner holds the lease. */
  acquire(threadId: string, owner: unknown): boolean {
    const holder = this.#holders.get(threadId);
    if (holder !== undefined && holder !== owner) return false;
    this.#holders.set(threadId, owner);
    return true;
  }

  release(threadId: string, owner: unknown): void {
    if (this.#holders.get(threadId) !== owner) return;
    this.#holders.delete(threadId);
    for (const listener of [...this.#listeners]) listener(threadId);
  }

  heldByOther(threadId: string, owner: unknown): boolean {
    const holder = this.#holders.get(threadId);
    return holder !== undefined && holder !== owner;
  }

  heldBy(owner: unknown): string[] {
    return [...this.#holders].filter(([, holder]) => holder === owner).map(([id]) => id);
  }
}
