import { useState, useEffect, useCallback } from 'react';
import { VERSION_STORAGE_KEY } from '@/lib/version';

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  const [installedVersion, setInstalledVersion] = useState<string | null>(() => {
    try {
      return localStorage.getItem(VERSION_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const fetchServerVersion = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`);
      if (!res.ok) throw new Error('Failed to fetch version');
      const data = await res.json();
      return data.version ?? null;
    } catch (error) {
      console.error('Failed to check version:', error);
      return null;
    }
  }, []);

  const checkForUpdate = useCallback(async (): Promise<string | null> => {
    const serverVersion = await fetchServerVersion();
    if (!serverVersion) return null;

    setLatestVersion(serverVersion);

    let storedVersion: string | null = null;
    try {
      storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
    } catch (e) {
      console.warn('[Update] Cannot read localStorage:', e);
      storedVersion = null;
    }

    setInstalledVersion(storedVersion);

    console.log('[Update] Check: stored=', storedVersion, 'server=', serverVersion);

    if (storedVersion && storedVersion !== serverVersion) {
      console.log('[Update] Update available:', storedVersion, '->', serverVersion);
      setUpdateAvailable(true);
    } else if (storedVersion && storedVersion === serverVersion) {
      console.log('[Update] Already up-to-date');
      setUpdateAvailable(false);
    } else if (!storedVersion) {
      console.log('[Update] First time, storing:', serverVersion);
      localStorage.setItem(VERSION_STORAGE_KEY, serverVersion);
      setInstalledVersion(serverVersion);
      setUpdateAvailable(false);
    }

    return serverVersion;
  }, [fetchServerVersion]);

  useEffect(() => {
    checkForUpdate();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', async () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[Update] SW update detected, verifying version...');
                await checkForUpdate();
              }
            });
          }
        });
      });
    }
  }, [checkForUpdate]);

  const applyUpdate = useCallback(async () => {
    setIsUpdating(true);
    console.log('[Update] Starting update process...');
    
    try {
      const serverVersion = (await checkForUpdate()) ?? latestVersion;
      if (serverVersion) {
        try {
          localStorage.setItem(VERSION_STORAGE_KEY, serverVersion);
          const confirm = localStorage.getItem(VERSION_STORAGE_KEY);
          console.log('[Update] Version saved:', serverVersion, 'confirm:', confirm);
        } catch (e) {
          console.error('[Update] Cannot write localStorage:', e);
        }

        setInstalledVersion(serverVersion);
        setUpdateAvailable(false);

        await new Promise((r) => setTimeout(r, 150));
      }
      
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            console.log('[Update] SW skip waiting sent');
          }
        } catch (swError) {
          console.warn('[Update] SW error (continuing):', swError);
        }
      }

      if ('caches' in window) {
        try {
          const cachePromise = (async () => {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            console.log('[Update] Caches cleared:', cacheNames.length);
          })();
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Cache clear timeout')), 3000)
          );
          
          await Promise.race([cachePromise, timeoutPromise]);
        } catch (cacheError) {
          console.warn('[Update] Cache clear skipped:', cacheError);
        }
      }
    } catch (error) {
      console.error('[Update] Error during update:', error);
    }
    
    console.log('[Update] Reloading...');
    window.location.reload();
  }, [checkForUpdate, latestVersion]);

  return {
    updateAvailable,
    isUpdating,
    applyUpdate,
    checkForUpdate,
    currentVersion: installedVersion,
    latestVersion,
  };
}
