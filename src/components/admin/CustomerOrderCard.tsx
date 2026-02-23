import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ExternalLink, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CustomerOrderCardProps {
  itemDate: string;
  status: string;
  addressName?: string;
  addressStreet?: string;
  addressCity?: string;
  services: { name: string; price?: number }[];
  price?: number;
  protocolPublicToken?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  confirmed: { label: 'Potwierdzone', className: 'bg-green-100 text-green-800 border-green-200' },
  pending: { label: 'Do potwierdzenia', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  completed: { label: 'Zakończone', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  cancelled: { label: 'Anulowane', className: 'bg-red-100 text-red-800 border-red-200' },
};

const CustomerOrderCard = ({
  itemDate,
  status,
  addressName,
  addressStreet,
  addressCity,
  services,
  price,
  protocolPublicToken,
}: CustomerOrderCardProps) => {
  const statusInfo = statusConfig[status] || { label: status, className: 'bg-muted text-muted-foreground' };

  let formattedDate = itemDate;
  try {
    formattedDate = format(parseISO(itemDate), 'd MMM yyyy', { locale: pl });
  } catch {}

  const hasAddress = addressName || addressStreet || addressCity;

  return (
    <div className="border rounded-lg p-3 space-y-2">
      {/* Top: date + status */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{formattedDate}</span>
        <Badge variant="outline" className={statusInfo.className}>
          {statusInfo.label}
        </Badge>
      </div>

      {/* Address */}
      {hasAddress && (
        <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            {addressName && <div className="font-medium text-foreground">{addressName}</div>}
            {(addressStreet || addressCity) && (
              <div>{[addressStreet, addressCity].filter(Boolean).join(', ')}</div>
            )}
          </div>
        </div>
      )}

      {/* Services */}
      {services.length > 0 && (
        <div className="text-sm space-y-0.5">
          {services.map((s, i) => (
            <div key={i} className="flex justify-between text-muted-foreground">
              <span>{s.name}</span>
              {s.price != null && <span>{s.price.toFixed(2)} zł</span>}
            </div>
          ))}
        </div>
      )}

      {/* Bottom: total + protocol link */}
      <div className="flex items-center justify-between pt-1 border-t">
        <span className="text-sm font-semibold">
          {price != null ? `${price.toFixed(2)} zł` : '—'}
        </span>
        {protocolPublicToken && (
          <a
            href={`/protocol/${protocolPublicToken}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            Protokół <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
};

export default CustomerOrderCard;
