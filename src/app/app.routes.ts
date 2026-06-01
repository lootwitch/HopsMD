// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/viewer-shell/viewer-shell.component').then(
        (m) => m.ViewerShellComponent,
      ),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./components/settings-page/settings-page.component').then(
        (m) => m.SettingsPageComponent,
      ),
  },
  { path: '**', redirectTo: '' },
];
