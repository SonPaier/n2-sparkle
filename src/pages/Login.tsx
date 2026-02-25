import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Lock, ArrowRight, Loader2, Building2, Eye, EyeOff, Wrench, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Instance {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  active: boolean;
}

interface LoginProps {
  subdomainSlug?: string;
}

interface FormErrors {
  username?: string;
  password?: string;
  general?: string;
}

const Login = ({ subdomainSlug }: LoginProps) => {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const slug = subdomainSlug || paramSlug;
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn, hasRole, hasInstanceRole } = useAuth();

  const [loading, setLoading] = useState(false);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [instanceLoading, setInstanceLoading] = useState(true);
  const [instanceError, setInstanceError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const returnTo = '/dashboard';

  // Fetch instance by slug
  useEffect(() => {
    const fetchInstance = async () => {
      if (!slug) {
        setInstanceError('Brak identyfikatora instancji');
        setInstanceLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('instances')
        .select('id, name, slug, logo_url, primary_color, active')
        .eq('slug', slug)
        .maybeSingle();

      if (error) {
        setInstanceError('Wystąpił błąd podczas wczytywania instancji');
        setInstanceLoading(false);
        return;
      }
      if (!data) {
        setInstanceError('Nie znaleziono instancji');
        setInstanceLoading(false);
        return;
      }
      if (!data.active) {
        setInstanceError('Ta instancja jest nieaktywna');
        setInstanceLoading(false);
        return;
      }

      setInstance(data);
      setInstanceLoading(false);
    };

    fetchInstance();
  }, [slug]);

  // Redirect if already logged in with proper role
  useEffect(() => {
    if (authLoading || instanceLoading || !user || !instance) return;

    const hasAccess = hasRole('super_admin') ||
      hasInstanceRole('admin', instance.id) ||
      hasInstanceRole('employee', instance.id) ||
      hasInstanceRole('hall', instance.id);

    if (hasAccess) {
      supabase
        .from('profiles')
        .select('is_blocked')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.is_blocked) {
            setErrors({ general: 'Twoje konto zostało zablokowane' });
            return;
          }
          navigate(returnTo, { replace: true });
        });
    }
  }, [authLoading, instanceLoading, user, instance, hasRole, hasInstanceRole, navigate, returnTo]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!username.trim()) newErrors.username = 'Login jest wymagany';
    if (!password) newErrors.password = 'Hasło jest wymagane';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validateForm()) return;
    if (!instance) {
      setErrors({ general: 'Nie można zalogować - brak instancji' });
      return;
    }

    setLoading(true);
    try {
      const { data: profile, error: lookupError } = await supabase
        .from('profiles')
        .select('id, email, is_blocked')
        .eq('username', username)
        .eq('instance_id', instance.id)
        .maybeSingle();

      if (lookupError || !profile?.email) {
        setErrors({ general: 'Nieprawidłowy login lub hasło' });
        setLoading(false);
        return;
      }

      if (profile.is_blocked) {
        setErrors({ general: 'Twoje konto zostało zablokowane. Skontaktuj się z administratorem.' });
        setLoading(false);
        return;
      }

      const { error } = await signIn(profile.email, password);
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrors({ general: 'Nieprawidłowy login lub hasło' });
        } else {
          setErrors({ general: error.message });
        }
      } else {
        navigate(returnTo);
      }
    } catch {
      setErrors({ general: 'Wystąpił błąd. Spróbuj ponownie.' });
    } finally {
      setLoading(false);
    }
  };

  const clearFieldError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (instanceLoading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (instanceError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 mb-4">
            <Building2 className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{instanceError}</h1>
          <p className="text-muted-foreground">Sprawdź czy adres URL jest poprawny</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col bg-card">
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12">
          <div className="w-full max-w-md space-y-8">
            {/* Logo */}
            <div className="space-y-4 text-center">
              {instance?.logo_url ? (
                <div className="flex justify-center mb-6">
                  <img src={instance.logo_url} alt={instance.name} className="h-20 object-scale-down" />
                </div>
              ) : (
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-2xl">N2</span>
                  </div>
                </div>
              )}
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Logowanie do panelu
              </h1>
            </div>

            {/* General error */}
            {errors.general && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive">{errors.general}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-muted-foreground">Login</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      clearFieldError('username');
                    }}
                    className={`pl-10 h-12 ${errors.username ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    autoComplete="username"
                  />
                </div>
                {errors.username && <p className="text-sm text-destructive">{errors.username}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-muted-foreground">Hasło</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearFieldError('password');
                    }}
                    className={`pl-10 pr-10 h-12 ${errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>

              <Button type="submit" className="w-full h-12 gap-2 text-base font-semibold" disabled={loading}>
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Zaloguj się
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border/50">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} N2Service</span>
            <a href="https://n2works.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              n2works.com
            </a>
            <a href="tel:+48666610222" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Phone className="w-3 h-3" />
              +48 666 610 222
            </a>
            <a href="mailto:hey@n2works.com" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Mail className="w-3 h-3" />
              hey@n2works.com
            </a>
          </div>
        </div>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-secondary relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-40 left-10 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-white">
          <div className="max-w-md text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm mb-4">
              <Wrench className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-bold">N2Service</h2>
            <p className="text-white/70 text-lg">
              Zarządzaj serwisem, klientami i usługami w jednym miejscu.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
