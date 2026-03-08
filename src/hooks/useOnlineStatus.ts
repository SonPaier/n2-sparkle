import { useState, useEffect } from 'react';

const THEME_COLOR_ONLINE = '#1a1a2e';
const THEME_COLOR_OFFLINE = '#6b7280';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Update theme-color meta tag
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', isOnline ? THEME_COLOR_ONLINE : THEME_COLOR_OFFLINE);
    }
  }, [isOnline]);

  return { isOnline };
}
