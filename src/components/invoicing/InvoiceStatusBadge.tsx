import { cn } from '@/lib/utils';
import { PAYMENT_STATUS_CONFIG, type PaymentStatus } from './invoicing.types';

interface InvoiceStatusBadgeProps {
  status: PaymentStatus | string | null;
  className?: string;
  size?: 'sm' | 'default';
}

export function InvoiceStatusBadge({ status, className, size = 'default' }: InvoiceStatusBadgeProps) {
  const key = (status || 'not_invoiced') as PaymentStatus;
  const config = PAYMENT_STATUS_CONFIG[key] || PAYMENT_STATUS_CONFIG.not_invoiced;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        config.color,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
