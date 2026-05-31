// ============================================================
// Optimistic Updates — unified optimistic write + failure rollback
// ============================================================

export interface OptimisticOptions<T> {
  /** Apply the optimistic change immediately to local state */
  apply: (current: T) => T;
  /** API call that performs the actual operation */
  execute: () => Promise<T>;
  /** Rollback to the previous state on failure */
  rollback: (previous: T) => void;
  /** Optional: reconcile server result with local state */
  reconcile?: (serverResult: T) => T;
}

/**
 * Execute an operation with optimistic local state update.
 * On success, the local state is reconciled with the server result (if reconcile is provided).
 * On failure, the local state is rolled back to the snapshot taken before apply().
 *
 * Usage:
 *   const result = await optimisticUpdate(setState, getState, {
 *     apply: (prev) => prev.map(c => c.id === id ? { ...c, title } : c),
 *     execute: () => renameConversation(id, title),
 *     rollback: (prev) => setConversations(prev),
 *   });
 */
export async function optimisticUpdate<T>(
  getState: () => T,
  setState: (updater: (prev: T) => T) => void,
  options: OptimisticOptions<T>
): Promise<T> {
  const snapshot = getState();

  // Apply optimistic change immediately
  setState(() => options.apply(snapshot));

  try {
    const serverResult = await options.execute();
    // Reconcile with server result if a reconciler is provided
    if (options.reconcile) {
      setState(() => options.reconcile!(serverResult));
    }
    return serverResult;
  } catch (error) {
    // Rollback on failure
    options.rollback(snapshot);
    throw error;
  }
}

/**
 * React hook wrapper for optimisticUpdate.
 * Provides a stable `execute` function bound to the given getState/setState.
 */
export function createOptimisticExecutor<T>(
  getState: () => T,
  setState: (updater: (prev: T) => T) => void
) {
  return (options: OptimisticOptions<T>) =>
    optimisticUpdate(getState, setState, options);
}
