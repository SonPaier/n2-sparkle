import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export const OfflineBanner = () => {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[101] bg-amber-500 text-white p-3 flex items-center justify-center gap-2 shadow-lg">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span className="text-sm font-medium">
        Brak połączenia z internetem. Dane mogą być nieaktualne.
      </span>
    </div>
  );
};
