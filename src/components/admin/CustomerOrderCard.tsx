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
  customerName?: string | null;
  addressCity?: string | null;
  addressStreet?: string | null;
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
  customerName,
  addressCity,
  addressStreet,
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

  const addressParts = [addressCity, addressStreet].filter(Boolean).join(', ');

  return (
    <div
      className="bg-white border rounded-lg p-3 space-y-1.5 cursor-pointer hover:border-primary/30 transition-colors"
      onClick={onClick}
    >
      {/* Title — max 2 lines */}
      {title && <div className="text-sm font-semibold line-clamp-2">{title}</div>}

      {/* Date — black font, full range */}
      <div className="text-xs font-medium text-foreground">{dateDisplay}</div>

      {/* Customer name */}
      {customerName && (
        <div className="text-xs text-muted-foreground truncate">{customerName}</div>
      )}

      {/* Service address */}
      {addressParts && (
        <div className="text-xs text-muted-foreground truncate">{addressParts}</div>
      )}

      {/* Price */}
      {!hidePrices && price != null && (
        <div className="text-sm font-semibold">{price.toFixed(2)} zł</div>
      )}

      {/* Status badge + employee pills */}
      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
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
