import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';

const TYPE_ICONS: Record<string, string> = {
  item_assigned: '📋',
  item_deleted: '🗑️',
  item_rescheduled: '📅',
  item_started: '▶️',
  item_completed: '✅',
  reminder_due: '🔔',
};

interface NotificationBellProps {
  instanceId: string | null;
  onItemClick?: (calendarItemId: string) => void;
  onViewAll?: () => void;
}

const NotificationBell = ({ instanceId, onItemClick, onViewAll }: NotificationBellProps) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(instanceId);

  const handleClick = (n: Notification) => {
    markAsRead(n.id);
    if (n.calendar_item_id && onItemClick) {
      onItemClick(n.calendar_item_id);
    }
  };

  const recent = notifications.slice(0, 10);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Powiadomienia">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-[400px] overflow-auto">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="font-semibold text-sm">Powiadomienia</span>
          {unreadCount > 0 && (
            <button onClick={() => markAllAsRead()} className="text-xs text-primary hover:underline">
              Oznacz wszystkie
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">Brak powiadomień</div>
        ) : (
          <div>
            {recent.map(n => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  "px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-accent/50 transition-colors",
                  !n.read && "bg-primary/5"
                )}
              >
                <div className="flex gap-2">
                  <span className="text-base shrink-0">{TYPE_ICONS[n.type] || '🔔'}</span>
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-sm leading-tight", !n.read && "font-semibold")}>{n.title}</div>
                    {n.description && <div className="text-xs text-muted-foreground mt-0.5 truncate">{n.description}</div>}
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: pl })}
                    </div>
                  </div>
                  {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                </div>
              </div>
            ))}
          </div>
        )}
        {onViewAll && (
          <div className="px-4 py-2 border-t border-border">
            <button onClick={onViewAll} className="text-xs text-primary hover:underline w-full text-center">
              Zobacz wszystkie
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
