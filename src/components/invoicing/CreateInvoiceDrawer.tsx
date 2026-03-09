import { X, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useInvoiceForm, type UseInvoiceFormOptions } from './useInvoiceForm';
import { InvoiceForm } from './InvoiceForm';
import type { InvoicePosition } from './invoicing.types';

interface CreateInvoiceDrawerProps {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  calendarItemId?: string;
  customerId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerNip?: string | null;
  positions?: InvoicePosition[];
  onSuccess?: () => void;
}

export function CreateInvoiceDrawer({
  open,
  onClose,
  instanceId,
  calendarItemId,
  customerId,
  customerName,
  customerEmail,
  customerNip,
  positions: initialPositions,
  onSuccess,
}: CreateInvoiceDrawerProps) {
  const isMobile = useIsMobile();

  const form = useInvoiceForm(open, {
    instanceId,
    calendarItemId,
    customerId,
    customerName,
    customerEmail,
    customerNip,
    positions: initialPositions,
    onSuccess,
    onClose,
  });

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        hideCloseButton
        hideOverlay
        className="flex flex-col p-0 gap-0 z-[1000] w-full sm:w-[550px] sm:max-w-[550px] h-full"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetTitle className="sr-only">Wystaw fakturę</SheetTitle>
        <SheetDescription className="sr-only">Formularz wystawiania faktury</SheetDescription>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Wystaw fakturę</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-primary/5 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <InvoiceForm
            kind={form.kind}
            onKindChange={form.setKind}
            issueDate={form.issueDate}
            onIssueDateChange={form.setIssueDate}
            sellDate={form.sellDate}
            onSellDateChange={form.setSellDate}
            paymentDays={form.paymentDays}
            onPaymentDaysChange={form.setPaymentDays}
            buyerName={form.buyerName}
            onBuyerNameChange={form.setBuyerName}
            buyerTaxNo={form.buyerTaxNo}
            onBuyerTaxNoChange={form.setBuyerTaxNo}
            buyerEmail={form.buyerEmail}
            onBuyerEmailChange={form.setBuyerEmail}
            buyerStreet={form.buyerStreet}
            onBuyerStreetChange={form.setBuyerStreet}
            buyerPostCode={form.buyerPostCode}
            onBuyerPostCodeChange={form.setBuyerPostCode}
            buyerCity={form.buyerCity}
            onBuyerCityChange={form.setBuyerCity}
            positions={form.positions}
            onAddPosition={form.addPosition}
            onRemovePosition={form.removePosition}
            onUpdatePosition={form.updatePosition}
            priceMode={form.priceMode}
            onPriceModeChange={form.setPriceMode}
            totalNetto={form.totalNetto}
            totalVat={form.totalVat}
            totalGross={form.totalGross}
            paymentTo={form.paymentTo}
            autoSendEmail={form.autoSendEmail}
            onAutoSendEmailChange={form.setAutoSendEmail}
            settingsActive={form.settings?.active}
          />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border px-6 py-4 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Anuluj
          </Button>
          <Button
            onClick={form.handleSubmit}
            disabled={form.submitting || !form.settings?.active}
            className="flex-1"
          >
            {form.submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Wystaw fakturę
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
