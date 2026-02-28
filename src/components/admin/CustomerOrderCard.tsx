import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

interface CustomerOrderCardProps {
  itemDate: string;
  endDate?: string | null;
  title?: string;
  status: string;
  services: { name: string; price?: number }[];
  price?: number;
  onClick?: () => void;
  hidePrices?: boolean;
  assignedEmployeeNames?: string[];
}

const statusConfig: Record<string, { label: string; className: string }> = {
  confirmed: { label: 'Do wykonania', className: 'bg-green-100 text-green-800 border-green-200' },
  in_progress: { label: 'W trakcie', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  completed: { label: 'Zakończone', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  cancelled: { label: 'Anulowane', className: 'bg-red-100 text-red-800 border-red-200' },
  change_requested: { label: 'Zmiana', className: 'bg-red-100 text-red-800 border-red-200' },
};

const CustomerOrderCard = ({
  itemDate,
  endDate,
  title,
  status,
  services,
  price,
  onClick,
  hidePrices,
  assignedEmployeeNames,
}: CustomerOrderCardProps) => {
  const statusInfo = statusConfig[status] || { label: status, className: 'bg-muted text-muted-foreground' };

  let formattedDate = itemDate;
  try {
    formattedDate = format(parseISO(itemDate), 'd MMM yyyy', { locale: pl });
  } catch {}

  const isMultiDay = endDate && endDate !== itemDate;
  let dateDisplay = formattedDate;
  if (isMultiDay) {
    try {
      const endFormatted = format(parseISO(endDate), 'd MMM yyyy', { locale: pl });
      dateDisplay = `${formattedDate} — ${endFormatted}`;
    } catch {}
  }

  return (
    <div
      className="bg-white border rounded-lg p-3 space-y-2 cursor-pointer hover:border-primary/30 transition-colors"
      onClick={onClick}
    >
      {/* Line 1: date, title, price */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{dateDisplay}</div>
          {title && <div className="text-sm font-semibold truncate">{title}</div>}
        </div>
        {!hidePrices && price != null && (
          <span className="text-sm font-semibold shrink-0">{price.toFixed(2)} zł</span>
        )}
      </div>

      {/* Line 2: status badge + employee pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge variant="outline" className={statusInfo.className}>
          {statusInfo.label}
        </Badge>
        {assignedEmployeeNames && assignedEmployeeNames.length > 0 && (
          assignedEmployeeNames.map((name, i) => (
            <span key={i} className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-primary text-primary-foreground">
              {name.split(' ')[0]}
            </span>
          ))
        )}
      </div>
    </div>
  );
};

export default CustomerOrderCard;
