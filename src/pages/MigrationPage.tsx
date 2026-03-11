import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Database, Users, ArrowLeft, Download, Upload, HardDrive, FileCode } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const MigrationPage = () => {
  const navigate = useNavigate();
  const [targetUrl, setTargetUrl] = useState('');
  const [targetServiceRoleKey, setTargetServiceRoleKey] = useState('');
  const [targetDbUrl, setTargetDbUrl] = useState('');

  const [migrationLog, setMigrationLog] = useState<string[]>([]);
  const [migrationErrors, setMigrationErrors] = useState<string[]>([]);
  const [migrationRunning, setMigrationRunning] = useState(false);
  const [authUsersDump, setAuthUsersDump] = useState<any[] | null>(null);

  const hasTargetConfig = targetUrl.trim() && targetServiceRoleKey.trim();

  const runMigration = async (dryRun: boolean) => {
    if (!hasTargetConfig) { toast.error('Podaj URL i Service Role Key docelowego projektu'); return; }
    if (!dryRun && !confirm('Czy na pewno chcesz uruchomić migrację WSZYSTKICH danych?')) return;
    setMigrationRunning(true);
    setMigrationLog([]);
    setMigrationErrors([]);
    try {
      const { data, error } = await supabase.functions.invoke('migrate-data-to-target', {
        body: { all: true, dry_run: dryRun, target_url: targetUrl, target_service_role_key: targetServiceRoleKey },
      });
      if (error) throw error;
      setMigrationLog(data.log || []);
      setMigrationErrors(data.errors || []);
      toast.success(dryRun ? `Dry run zakończony: ${data.instances_count} instancji` : `Migracja zakończona: ${data.instances_count} instancji`);
    } catch (e: any) {
      toast.error('Błąd: ' + (e.message || String(e)));
      setMigrationErrors([String(e)]);
    } finally {
      setMigrationRunning(false);
    }
  };

  const dumpAuthUsers = async () => {
    setMigrationRunning(true);
    setMigrationLog([]);
    setMigrationErrors([]);
    try {
      const { data, error } = await supabase.functions.invoke('dump-auth-users');
      if (error) throw error;
      setAuthUsersDump(data.users);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auth-users-dump-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Pobrano ${data.count} użytkowników`);
      setMigrationLog([`Pobrano ${data.count} użytkowników auth.users (gotowe do importu)`]);
      if (data.warning) setMigrationErrors([data.warning]);
    } catch (e: any) {
      toast.error('Błąd: ' + (e.message || String(e)));
      setMigrationErrors([String(e)]);
    } finally {
      setMigrationRunning(false);
    }
  };

  const importAuthUsers = async (dryRun: boolean) => {
    if (!authUsersDump) { toast.error('Najpierw kliknij "Dump auth.users"'); return; }
    if (!targetDbUrl.trim()) { toast.error('Podaj TARGET DB URL (connection string)'); return; }
    if (!dryRun && !confirm(`⚠️ LIVE IMPORT: Utworzyć ${authUsersDump.length} użytkowników w NOWYM projekcie?`)) return;
    setMigrationRunning(true);
    setMigrationLog([]);
    setMigrationErrors([]);
    try {
      const { data, error } = await supabase.functions.invoke('import-auth-users', {
        body: { users: authUsersDump, dry_run: dryRun, target_db_url: targetDbUrl },
      });
      if (error) throw error;
      setMigrationLog(data.log || []);
      setMigrationErrors(data.errors || []);
      toast.success(dryRun ? `Dry run: ${data.created} do utworzenia, ${data.skipped} pominiętych` : `Import: ${data.created} utworzonych, ${data.skipped} pominiętych`);
    } catch (e: any) {
      toast.error('Błąd: ' + (e.message || String(e)));
      setMigrationErrors([String(e)]);
    } finally {
      setMigrationRunning(false);
    }
  };

  const migrateStorage = async (dryRun: boolean) => {
    if (!hasTargetConfig) { toast.error('Podaj URL i Service Role Key docelowego projektu'); return; }
    if (!dryRun && !confirm('Migracja plików Storage. Kontynuować?')) return;
    setMigrationRunning(true);
    setMigrationLog([]);
    setMigrationErrors([]);
    try {
      const { data, error } = await supabase.functions.invoke('migrate-storage', {
        body: { dry_run: dryRun, batch_limit: 100, target_url: targetUrl, target_service_role_key: targetServiceRoleKey },
      });
      if (error) throw error;
      setMigrationLog(data.log || []);
      setMigrationErrors(data.errors || []);
      toast.success(dryRun ? `Storage dry run: ${data.total_files} plików` : `Storage: ${data.total_migrated} przesłanych, ${data.total_skipped} pominiętych`);
    } catch (e: any) {
      toast.error('Błąd: ' + (e.message || String(e)));
      setMigrationErrors([String(e)]);
    } finally {
      setMigrationRunning(false);
    }
  };

  const exportSchema = async () => {
    setMigrationRunning(true);
    setMigrationLog([]);
    setMigrationErrors([]);
    try {
      const { data, error } = await supabase.functions.invoke('export-schema');
      if (error) throw error;
      const blob = new Blob([data.schema], { type: 'text/sql' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `schema-export-${new Date().toISOString().slice(0, 10)}.sql`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Pobrano schemat: ${data.tables_count} tabel, ${data.policies_count} polityk, ${data.functions_count} funkcji`);
      setMigrationLog([`Schemat wyeksportowany: ${data.tables_count} tabel, ${data.policies_count} polityk RLS, ${data.functions_count} funkcji`]);
    } catch (e: any) {
      toast.error('Błąd: ' + (e.message || String(e)));
      setMigrationErrors([String(e)]);
    } finally {
      setMigrationRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Migracja danych</h1>
            <p className="text-muted-foreground">Przeniesienie danych do nowego projektu Supabase</p>
          </div>
        </div>

        {/* Schema export - FIRST STEP */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCode className="w-5 h-5" /> 1. Eksport schematu bazy
            </CardTitle>
            <CardDescription>Pobierz pełny SQL schematu (tabele, RLS, funkcje, triggery, storage) i wklej go w SQL Editor nowego projektu PRZED migracją danych</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button disabled={migrationRunning} variant="outline" className="gap-2" onClick={exportSchema}>
              {migrationRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCode className="w-4 h-4" />}
              📋 Pobierz schemat SQL
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Konfiguracja docelowego projektu</CardTitle>
            <CardDescription>Podaj dane dostępowe do nowego projektu Supabase</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Supabase URL</Label>
              <Input
                placeholder="https://xxxxx.supabase.co"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Service Role Key</Label>
              <Input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIs..."
                value={targetServiceRoleKey}
                onChange={(e) => setTargetServiceRoleKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>DB URL (connection string) — do importu auth.users</Label>
              <Input
                type="password"
                placeholder="postgresql://postgres.[ref]:[password]@..."
                value={targetDbUrl}
                onChange={(e) => setTargetDbUrl(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Data migration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="w-5 h-5" /> Migracja tabel
            </CardTitle>
            <CardDescription>Przeniesienie instancji, klientów, kalendarza, usług i całej reszty</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button disabled={migrationRunning || !hasTargetConfig} variant="outline" className="gap-2" onClick={() => runMigration(true)}>
              {migrationRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              Dry Run (wszystkie instancje)
            </Button>
            <Button disabled={migrationRunning || !hasTargetConfig} className="gap-2" onClick={() => runMigration(false)}>
              {migrationRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              🚀 Uruchom migrację
            </Button>
          </CardContent>
        </Card>

        {/* Auth users migration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" /> Migracja auth.users
            </CardTitle>
            <CardDescription>Dump i import użytkowników z oryginalnymi hasłami (wymaga DB URL)</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button disabled={migrationRunning} variant="outline" className="gap-2 border-amber-500/50 text-amber-600 hover:bg-amber-500/10" onClick={dumpAuthUsers}>
              {migrationRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Dump auth.users (z hasłami)
            </Button>
            <Button disabled={migrationRunning || !authUsersDump || !targetDbUrl} variant="outline" className="gap-2 border-green-500/50 text-green-600 hover:bg-green-500/10" onClick={() => importAuthUsers(true)}>
              {migrationRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              Import Dry Run ({authUsersDump?.length ?? 0} userów)
            </Button>
            <Button disabled={migrationRunning || !authUsersDump || !targetDbUrl} className="gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white" onClick={() => importAuthUsers(false)}>
              {migrationRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              🚀 Import LIVE ({authUsersDump?.length ?? 0} userów)
            </Button>
          </CardContent>
        </Card>

        {/* Storage migration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <HardDrive className="w-5 h-5" /> Migracja Storage
            </CardTitle>
            <CardDescription>Przeniesienie plików z bucketów (instance-logos, employee-photos, protocol-photos, media-files)</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button disabled={migrationRunning || !hasTargetConfig} variant="outline" className="gap-2 border-blue-500/50 text-blue-600 hover:bg-blue-500/10" onClick={() => migrateStorage(true)}>
              {migrationRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
              📦 Storage Dry Run
            </Button>
            <Button disabled={migrationRunning || !hasTargetConfig} className="gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white" onClick={() => migrateStorage(false)}>
              {migrationRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
              📦 Migruj Storage
            </Button>
          </CardContent>
        </Card>

        {/* Logs */}
        {migrationLog.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Log ({migrationLog.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs text-muted-foreground max-h-96 overflow-auto whitespace-pre-wrap bg-muted/50 rounded p-3">
                {migrationLog.join('\n')}
              </pre>
            </CardContent>
          </Card>
        )}

        {migrationErrors.length > 0 && (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-lg text-destructive">Błędy ({migrationErrors.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs text-destructive max-h-96 overflow-auto whitespace-pre-wrap bg-destructive/5 rounded p-3">
                {migrationErrors.join('\n')}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MigrationPage;
