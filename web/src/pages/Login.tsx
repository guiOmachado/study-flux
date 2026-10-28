import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon, Logo } from '../components/Icon';
import { Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';
import { api, ApiError } from '../lib/api';

export function LoginPage() {
  const { user, login, register, demo } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Para onde voltar depois do login (ex.: /descobrir?tab=acervos). Só caminhos internos.
  const rawNext = params.get('next') ?? '';
  const redirectTo = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';
  const [mode, setMode] = useState<'login' | 'register'>(params.get('mode') === 'register' ? 'register' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'form' | 'demo' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Em deploy público a conta demo é desativada (SEED_DEMO=0) e o botão some.
  const [demoEnabled, setDemoEnabled] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .health()
      .then((health) => {
        if (alive) setDemoEnabled(health.demo);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (user) return <Navigate to={redirectTo} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy('form');
    try {
      if (mode === 'register') await register(name, email, password);
      else await login(email, password);
      navigate(redirectTo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  const enterDemo = async () => {
    setError(null);
    setBusy('demo');
    try {
      await demo();
      navigate(redirectTo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível abrir a conta demo.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="auth">
      <aside className="auth-aside">
        <div className="brand">
          <Logo size={40} />
          <div>
            <span className="brand-name">Study Flux</span>
            <span className="brand-sub">Do material ao caso clínico</span>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2>Suas provas antigas viram casos clínicos para treinar.</h2>
          <p>
            Envie um PDF de prova, um capítulo de livro ou cole um resumo. O Study Flux organiza o conteúdo, gera casos e ainda
            monta revisões espaçadas dos pontos que você errou.
          </p>
          <div className="auth-features">
            <div className="auth-feature">
              <Icon name="file" size={18} />
              <div>
                Material vira questão
                <small>PDF, DOCX, texto colado ou prova antiga com gabarito.</small>
              </div>
            </div>
            <div className="auth-feature">
              <Icon name="globe" size={18} />
              <div>
                Busca em acervos abertos
                <small>Artigos e capítulos do Europe PMC, NCBI Bookshelf, OpenAlex e PubMed.</small>
              </div>
            </div>
            <div className="auth-feature">
              <Icon name="stethoscope" size={18} />
              <div>
                Casos clínicos completos
                <small>Anamnese, exame físico, exames e perguntas em progressão.</small>
              </div>
            </div>
            <div className="auth-feature">
              <Icon name="layers" size={18} />
              <div>
                Revisão que acompanha você
                <small>O que você erra volta no momento certo, com repetição espaçada.</small>
              </div>
            </div>
            <div className="auth-feature">
              <Icon name="chart" size={18} />
              <div>
                Clareza sobre o que falta
                <small>Desempenho por área e tema, direto ao ponto.</small>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-quote">Feito para o período de provas: estudar com casos rende mais do que reler o capítulo.</div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div className="row" style={{ marginBottom: 22 }}>
            <Logo size={34} />
            <strong style={{ fontSize: 15, letterSpacing: '-0.02em' }}>Study Flux</strong>
          </div>
          <h1>{mode === 'login' ? 'Entrar na sua conta' : 'Criar conta'}</h1>
          <p className="small muted" style={{ marginBottom: 20 }}>
            {mode === 'login'
              ? 'Continue de onde parou e mantenha sua sequência de estudo.'
              : 'Leva menos de um minuto. Seus materiais ficam vinculados à sua conta.'}
          </p>

          <form className="stack" onSubmit={submit}>
            {mode === 'register' ? (
              <div className="field">
                <label htmlFor="name">Nome</label>
                <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como podemos te chamar?" autoComplete="name" required />
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" autoComplete="email" required />
            </div>
            <div className="field">
              <label htmlFor="password">Senha</label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Mínimo de 8 caracteres' : 'Sua senha'}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={mode === 'register' ? 8 : undefined}
                required
              />
            </div>

            {error ? (
              <div className="feedback bad" style={{ padding: '10px 12px' }}>
                <span>{error}</span>
              </div>
            ) : null}

            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={busy !== null}>
              {busy === 'form' ? <Spinner /> : null}
              {mode === 'login' ? 'Entrar' : 'Criar minha conta'}
            </button>
          </form>

          {demoEnabled ? (
            <div className="demo-box">
              <div>
                <strong className="small">Só quer ver como funciona?</strong>
                <div className="tiny muted">Conta demo com casos, materiais e histórico prontos.</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={enterDemo} disabled={busy !== null}>
                {busy === 'demo' ? <Spinner dark /> : <Icon name="sparkles" size={14} />}
                Entrar como demo
              </button>
            </div>
          ) : null}

          <div className="auth-guest">
            <div className="tiny muted" style={{ marginBottom: 6 }}>Ainda só quer pesquisar?</div>
            <Link className="btn btn-secondary btn-block" to="/descobrir">
              <Icon name="globe" size={15} />
              Buscar em acervos científicos sem conta
            </Link>
          </div>

          <div className="auth-switch">
            {mode === 'login' ? (
              <>
                Ainda não tem conta?{' '}
                <button className="btn btn-ghost btn-sm" style={{ padding: '2px 4px' }} onClick={() => { setMode('register'); setError(null); }}>
                  Criar agora
                </button>
              </>
            ) : (
              <>
                Já tem conta?{' '}
                <button className="btn btn-ghost btn-sm" style={{ padding: '2px 4px' }} onClick={() => { setMode('login'); setError(null); }}>
                  Entrar
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
