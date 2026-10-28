import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon, Logo } from './Icon';
import { useAuth } from '../lib/auth';
import { initials } from '../lib/format';
import { api } from '../lib/api';

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

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
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
  }, [location.pathname]);

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

        <div className="sidebar-foot">
          <div className="user-chip">
            <div className="avatar">{user ? initials(user.name) : '?'}</div>
            <div className="user-meta">
              <div className="user-name">{user?.name ?? 'Visitante'}</div>
              <div className="user-mail">{user?.email ?? ''}</div>
            </div>
            <button className="icon-btn" onClick={handleLogout} title="Sair" aria-label="Sair">
              <Icon name="logout" size={16} />
            </button>
          </div>
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
          <button className="icon-btn" onClick={handleLogout} aria-label="Sair">
            <Icon name="logout" size={18} />
          </button>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
