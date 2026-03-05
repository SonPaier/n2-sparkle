import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import EmptyState from '@/components/ui/empty-state';

const TYPE_ICONS: Record<string, string> = {
  item_assigned: '📋',
  item_deleted: '🗑️',
  item_rescheduled: '📅',
  item_started: '▶️',
  item_completed: '✅',
  reminder_due: '🔔',
};

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
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => markAllAsRead()}>
              <CheckCheck className="w-4 h-4" />
              Oznacz wszystkie
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => deleteAll()}>
              <Trash2 className="w-4 h-4" />
              Usuń wszystkie
            </Button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} message="Brak powiadomień" />
      ) : (
        <div className="space-y-1">
          {notifications.map(n => (
            <div
              key={n.id}
              onClick={() => handleClick(n)}
              className={cn(
                "px-4 py-3 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors flex gap-3 items-start",
                !n.read && "bg-primary/5"
              )}
            >
              <span className="text-lg shrink-0 mt-0.5">{TYPE_ICONS[n.type] || '🔔'}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0">
                    {TYPE_LABELS[n.type] || n.type}
                  </span>
                </div>
                {n.description && <div className="text-sm text-muted-foreground mt-0.5">{n.description}</div>}
                <div className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: pl })}
                </div>
              </div>
              {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsView;
