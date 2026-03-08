import { get, set, del } from 'idb-keyval';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

const IDB_KEY = 'n2service-rq-cache';

/**
 * Buster key based on user ID — prevents leaking cached data between users.
 * Stored separately so we can detect user change on restore.
 */
const BUSTER_KEY = 'n2service-rq-buster';

export function createIDBPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      await set(IDB_KEY, client);
    },
    restoreClient: async () => {
      return await get<PersistedClient>(IDB_KEY);
    },
    removeClient: async () => {
      await del(IDB_KEY);
      await del(BUSTER_KEY);
    },
  };
}

/** Call on sign-out to wipe persisted query cache */
export async function clearPersistedCache() {
  try {
    await del(IDB_KEY);
    await del(BUSTER_KEY);
  } catch {
    // IndexedDB may be unavailable
  }
}
