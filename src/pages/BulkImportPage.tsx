import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const TARGET_INSTANCE_ID = 'c32aa6e2-d63b-4707-a483-18cf36bec8ce';
const BATCH_SIZE = 100;

export default function BulkImportPage() {
  const [status, setStatus] = useState('idle');
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  const runImport = async () => {
    setStatus('running');
    setLog([]);
    addLog('Ładowanie plików JSON...');

    try {
      const [custRes, addrRes] = await Promise.all([
        fetch('/import/customers.json'),
        fetch('/import/service_addresses.json'),
      ]);
      const customers = await custRes.json();
      const addresses = await addrRes.json();

      addLog(`Załadowano ${customers.length} klientów i ${addresses.length} adresów`);

      // Send in chunks to avoid payload limits
      for (let i = 0; i < customers.length; i += BATCH_SIZE) {
        const custBatch = customers.slice(i, i + BATCH_SIZE);
        const custIds = new Set(custBatch.map((c: any) => c.id));
        const addrBatch = addresses.filter((a: any) => custIds.has(a.customer_id));

        addLog(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${custBatch.length} klientów, ${addrBatch.length} adresów...`);

        const { data, error } = await supabase.functions.invoke('bulk-import-mapped', {
          body: {
            targetInstanceId: TARGET_INSTANCE_ID,
            customers: custBatch,
            addresses: addrBatch,
          },
        });

        if (error) {
          addLog(`❌ Błąd batch: ${error.message}`);
          continue;
        }

        addLog(`✅ Klienci: ${data.customersInserted}, Adresy: ${data.addressesInserted}`);
        if (data.errors?.length) {
          data.errors.forEach((e: string) => addLog(`  ⚠️ ${e}`));
        }
      }

      addLog('🎉 Import zakończony!');
      setStatus('done');
    } catch (err: any) {
      addLog(`❌ Błąd: ${err.message}`);
      setStatus('error');
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Bulk Import - Tom Prestige</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Instance: {TARGET_INSTANCE_ID}
      </p>

      <button
        onClick={runImport}
        disabled={status === 'running'}
        className="bg-primary text-primary-foreground px-4 py-2 rounded mb-4 disabled:opacity-50"
      >
        {status === 'running' ? 'Importuję...' : 'Uruchom import'}
      </button>

      <div className="bg-muted rounded p-4 text-sm font-mono max-h-96 overflow-y-auto">
        {log.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
