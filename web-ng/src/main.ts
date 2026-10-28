import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig)
  .then(() => document.getElementById('boot')?.remove())
  .catch((error) => {
    console.error('Falha ao iniciar o Study Flux', error);
    const boot = document.getElementById('boot');
    if (boot) boot.textContent = 'Não foi possível carregar a interface. Recarregue a página.';
  });
