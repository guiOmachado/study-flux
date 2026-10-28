import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards';
import { Layout } from './shared/layout';
import { LoginPage } from './pages/login';
import { DashboardPage } from './pages/dashboard';
import { MaterialsPage } from './pages/materials';
import { MaterialDetailPage } from './pages/material-detail';
import { CasesPage } from './pages/cases';
import { CaseDetailPage } from './pages/case-detail';
import { CaseEditorPage } from './pages/case-editor';
import { TrainPage } from './pages/train';
import { SimuladoPage } from './pages/simulado';
import { ReviewPage } from './pages/review';
import { ProgressPage } from './pages/progress';
import { SettingsPage } from './pages/settings';
import { DiscoverPage } from './pages/discover';

export const routes: Routes = [
  { path: 'login', component: LoginPage, canActivate: [guestGuard] },
  {
    path: '',
    component: Layout,
    children: [
      // Pública: visitante pode pesquisar nos acervos sem conta.
      { path: 'descobrir', component: DiscoverPage },
      { path: '', pathMatch: 'full', component: DashboardPage, canActivate: [authGuard] },
      { path: 'materiais', component: MaterialsPage, canActivate: [authGuard] },
      { path: 'materiais/:id', component: MaterialDetailPage, canActivate: [authGuard] },
      { path: 'casos', component: CasesPage, canActivate: [authGuard] },
      { path: 'casos/novo', component: CaseEditorPage, canActivate: [authGuard] },
      { path: 'casos/:id', component: CaseDetailPage, canActivate: [authGuard] },
      { path: 'casos/:id/editar', component: CaseEditorPage, canActivate: [authGuard] },
      { path: 'treinar/:id', component: TrainPage, canActivate: [authGuard] },
      { path: 'simulado', component: SimuladoPage, canActivate: [authGuard] },
      { path: 'revisao', component: ReviewPage, canActivate: [authGuard] },
      { path: 'progresso', component: ProgressPage, canActivate: [authGuard] },
      { path: 'configuracoes', component: SettingsPage, canActivate: [authGuard] },
    ],
  },
  { path: '**', redirectTo: '' },
];
