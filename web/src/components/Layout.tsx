import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon, Logo } from './Icon';
import { useAuth } from '../lib/auth';
import { initials } from '../lib/format';
import { api } from '../lib/api';

const GUEST_NAV = [{ to: '/descobrir', label: 'Descobrir', icon: 'globe', end: false }];

const NAV = [
  { to: '/', label: 'Início', icon: 'home', end: true },
  { to: '/descobrir', label: 'Descobrir', icon: 'globe' },
  { to: '/materiais', label: 'Materiais', icon: 'folder' },
  { to: '/casos', label: 'Casos clínicos', icon: 'library' },
  { to: '/simulado', label: 'Simulado', icon: 'play' },
  { to: '/progresso', label: 'Progresso', icon: 'chart' },
];

export function Layout() {
  const [open, setOpen] = useState(false);
  const [due, setDue] = useState(0);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isGuest = !user;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isGuest) {
      setDue(0);
      return;
    }
    let alive = true;
    const load = () => {
      api.srs
        .list()
        .then(({ due: count }) => {
          if (alive) setDue(count);
        })
        .catch(() => undefined);
    };
    load();
    window.addEventListener('sf:srs-changed', load);
    return () => {
      alive = false;
      window.removeEventListener('sf:srs-changed', load);
    };
  }, [isGuest, location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="shell">
      {open ? <div className="sidebar-overlay" onClick={() => setOpen(false)} /> : null}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <NavLink to="/" className="brand">
          <Logo />
          <div>
            <span className="brand-name">Study Flux</span>
            <span className="brand-sub">Casos clínicos</span>
          </div>
        </NavLink>

        {isGuest ? (
          <>
            <span className="nav-label">Explorar</span>
            {GUEST_NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <Icon name={item.icon} size={17} />
                {item.label}
              </NavLink>
            ))}

            <div className="sidebar-cta">
              <div className="sidebar-cta-title">
                <Icon name="lock" size={14} />
                Modo visitante
              </div>
              <p className="tiny muted">
                Você pode buscar e ler os resultados dos acervos. Para importar, gerar casos, treinar e revisar, entre na sua conta.
              </p>
              <Link className="btn btn-primary btn-sm btn-block" to="/login?next=%2Fdescobrir">
                <Icon name="user" size={14} />
                Entrar
              </Link>
              <Link className="btn btn-ghost btn-sm btn-block" to="/login?mode=register&next=%2Fdescobrir">
                Criar conta grátis
              </Link>
            </div>
          </>
        ) : (
          <>
            <span className="nav-label">Estudar</span>
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <Icon name={item.icon} size={17} />
                {item.label}
              </NavLink>
            ))}

            <span className="nav-label">Revisar</span>
            <NavLink to="/revisao" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon name="layers" size={17} />
              Revisão espaçada
              {due > 0 ? <span className="nav-badge">{due}</span> : null}
            </NavLink>
            <NavLink to="/configuracoes" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon name="settings" size={17} />
              Configurações
            </NavLink>
          </>
        )}

        <div className="sidebar-foot">
          {isGuest ? (
            <div className="user-chip">
              <div className="avatar">?</div>
              <div className="user-meta">
                <div className="user-name">Visitante</div>
                <div className="user-mail">sem conta</div>
              </div>
              <Link className="icon-btn" to="/login?next=%2Fdescobrir" title="Entrar" aria-label="Entrar">
                <Icon name="user" size={16} />
              </Link>
            </div>
          ) : (
            <div className="user-chip">
              <div className="avatar">{initials(user.name)}</div>
              <div className="user-meta">
                <div className="user-name">{user.name}</div>
                <div className="user-mail">{user.email}</div>
              </div>
              <button className="icon-btn" onClick={handleLogout} title="Sair" aria-label="Sair">
                <Icon name="logout" size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Icon name="menu" size={20} />
          </button>
          <div className="row" style={{ gap: 8 }}>
            <Logo size={28} />
            <strong style={{ letterSpacing: '-0.02em' }}>Study Flux</strong>
          </div>
          {isGuest ? (
            <Link className="btn btn-primary btn-sm" to="/login?next=%2Fdescobrir">
              <Icon name="user" size={14} />
              Entrar
            </Link>
          ) : (
            <button className="icon-btn" onClick={handleLogout} aria-label="Sair">
              <Icon name="logout" size={18} />
            </button>
          )}
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
