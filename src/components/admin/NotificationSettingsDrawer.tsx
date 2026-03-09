import { useEffect } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { X, Smartphone, Check, Loader2, BellRing } from 'lucide-react';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { toast } from 'sonner';

interface NotificationSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string | null;
}

const NotificationSettingsDrawer = ({ open, onOpenChange, instanceId }: NotificationSettingsDrawerProps) => {
  const {
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    checkSubscription,
    isSupported,
  } = usePushSubscription(instanceId);

  useEffect(() => {
    if (open) {
      checkSubscription();
    }
  }, [open, checkSubscription]);

  const handleEnable = async () => {
    const result = await subscribe();
    if (result.success) {
      toast.success('Powiadomienia push włączone');
    } else if (result.error) {
      toast.error(result.error);
    }
  };

  const handleDisable = async () => {
    const result = await unsubscribe();
    if (result.success) {
      toast.success('Powiadomienia push wyłączone');
    } else if (result.error) {
      toast.error(result.error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[550px] sm:max-w-[550px] h-full p-0 flex flex-col z-[1000]" hideCloseButton>
        <div className="sticky top-0 z-10 bg-background border-b p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ustawienia powiadomień</h2>
            <button onClick={() => onOpenChange(false)} className="p-2 rounded-full hover:bg-primary/5">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Push notifications section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Powiadomienia push</h3>
            </div>

            {!isSupported ? (
              <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
                <div className="flex items-center gap-2">
                  <BellRing className="w-5 h-5 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Powiadomienia push nie są wspierane
                  </p>
                </div>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>Aby otrzymywać powiadomienia na telefon:</p>
                  <div className="space-y-1.5 ml-1">
                    <p><strong>iPhone:</strong> Otwórz stronę w Safari → Udostępnij → „Dodaj do ekranu głównego" → Otwórz zainstalowaną aplikację</p>
                    <p><strong>Android:</strong> Otwórz w Chrome/Edge → Menu → „Zainstaluj aplikację"</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground/60">
                  Chrome na iOS nie wspiera push — użyj Safari (ograniczenie Apple)
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-border bg-card space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Powiadomienia na tym urządzeniu
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isSubscribed
                      ? 'Otrzymujesz powiadomienia o zmianach w zleceniach na tym urządzeniu.'
                      : 'Włącz, aby otrzymywać powiadomienia push o nowych zleceniach, zmianach i przypomnieniach bezpośrednio na telefon.'}
                  </p>
                </div>

                {isSubscribed ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                      <Check className="w-5 h-5" />
                      <span className="text-sm font-medium">Powiadomienia włączone</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisable}
                      disabled={isLoading}
                    >
                      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Wyłącz powiadomienia
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={handleEnable}
                    disabled={isLoading}
                    size="sm"
                  >
                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Włącz powiadomienia push
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default NotificationSettingsDrawer;
