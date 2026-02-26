import { cn } from '@/lib/utils';
import { differenceInDays } from 'date-fns';
import { PAYMENT_STATUS_CONFIG, type PaymentStatus } from './invoicing.types';

interface InvoiceStatusBadgeProps {
  status: PaymentStatus | string | null;
  className?: string;
  size?: 'sm' | 'default';
  paymentTo?: string | null;
}

export function InvoiceStatusBadge({ status, className, size = 'default', paymentTo }: InvoiceStatusBadgeProps) {
  const key = (status || 'not_invoiced') as PaymentStatus;
  const config = PAYMENT_STATUS_CONFIG[key] || PAYMENT_STATUS_CONFIG.not_invoiced;

  let label = config.label;

  // Show overdue days count
  if (key === 'overdue' && paymentTo) {
    try {
      const days = differenceInDays(new Date(), new Date(paymentTo));
      if (days > 0) {
        label = `Po terminie (${days} dni)`;
      }
    } catch {
      // fallback to default label
    }
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        config.color,
        className,
      )}
    >
      {label}
    </span>
  );
}
