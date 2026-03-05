import { useState } from 'react';
import { Bell, CheckCheck, Trash2, Settings2 } from 'lucide-react';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import EmptyState from '@/components/ui/empty-state';
import NotificationSettingsDrawer from './NotificationSettingsDrawer';

const TYPE_LABELS: Record<string, string> = {
  item_assigned: 'Nowe zlecenie',
  item_deleted: 'Zlecenie usunięte',
  item_rescheduled: 'Zlecenie przełożone',
  item_started: 'Rozpoczęto zlecenie',
  item_completed: 'Zakończono zlecenie',
  reminder_due: 'Przypomnienie',
};

interface NotificationsViewProps {
  instanceId: string | null;
  onItemClick?: (calendarItemId: string) => void;
}

const NotificationsView = ({ instanceId, onItemClick }: NotificationsViewProps) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteAll } = useNotifications(instanceId);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const handleClick = (n: Notification) => {
    if (!n.read) markAsRead(n.id);
    if (n.calendar_item_id && onItemClick) {
      onItemClick(n.calendar_item_id);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-foreground">Aktywności</h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" title="Ustawienia powiadomień" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="w-4 h-4" />
          </Button>
          {unreadCount > 0 && (
            <Button variant="ghost" size="icon" title="Oznacz wszystkie jako przeczytane" onClick={() => markAllAsRead()}>
              <CheckCheck className="w-4 h-4" />
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Usuń wszystkie" onClick={() => deleteAll()}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} message="Brak powiadomień" />
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              className={cn(
                "px-4 py-3 rounded-lg border border-border/50 transition-colors",
                n.read
                  ? "bg-muted/30"
                  : "bg-card"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-card bg-foreground px-1.5 py-0.5 rounded">
                  {TYPE_LABELS[n.type] || n.type}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: pl })}
                </span>
              </div>
              {n.calendar_item_id && onItemClick ? (
                <button
                  onClick={() => handleClick(n)}
                  className="text-sm text-primary hover:underline text-left"
                >
                  {n.title}
                </button>
              ) : (
                <span className="text-sm text-foreground">{n.title}</span>
              )}
              
            </div>
          ))}
        </div>
      )}
      <NotificationSettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} instanceId={instanceId} />
    </div>
  );
};

export default NotificationsView;
