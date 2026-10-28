import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useAuth } from './lib/auth';
import { Spinner } from './components/ui';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { MaterialsPage } from './pages/Materials';
import { DiscoverPage } from './pages/Discover';
import { MaterialDetailPage } from './pages/MaterialDetail';
import { CasesPage } from './pages/Cases';
import { CaseDetailPage } from './pages/CaseDetail';
import { CaseEditorPage } from './pages/CaseEditor';
import { TrainPage } from './pages/Train';
import { SimuladoPage } from './pages/Simulado';
import { ReviewPage } from './pages/Review';
import { ProgressPage } from './pages/Progress';
import { SettingsPage } from './pages/Settings';

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="loading-screen">
        <Spinner dark />
        <span className="small">Preparando seu estudo…</span>
      </div>
    );
  }
  // Volta para onde o usuário estava tentando ir depois do login.
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <Layout />;
}

/** Casca pública: a busca em acervos pode ser usada por visitantes; o Layout se adapta. */
function PublicShell() {
  return <Layout />;
}

export function App() {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div className="loading-screen">
        <Spinner dark />
        <span className="small">Carregando…</span>
      </div>
    );
  }
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<PublicShell />}>
        <Route path="descobrir" element={<DiscoverPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route index element={<DashboardPage />} />
        <Route path="materiais" element={<MaterialsPage />} />
        <Route path="materiais/:id" element={<MaterialDetailPage />} />
        <Route path="casos" element={<CasesPage />} />
        <Route path="casos/novo" element={<CaseEditorPage />} />
        <Route path="casos/:id" element={<CaseDetailPage />} />
        <Route path="casos/:id/editar" element={<CaseEditorPage />} />
        <Route path="treinar/:id" element={<TrainPage />} />
        <Route path="simulado" element={<SimuladoPage />} />
        <Route path="revisao" element={<ReviewPage />} />
        <Route path="progresso" element={<ProgressPage />} />
        <Route path="configuracoes" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
