import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'mapa',
    redirectTo: 'onboarding',
    pathMatch: 'full',
  },
  {
    path: 'chat',
    loadComponent: () => import('./pages/chat/chat.page').then( m => m.ChatPage)
  },
  {
    path: 'mapa',
    loadComponent: () => import('./pages/mapa/mapa.page').then( m => m.MapaPage)
  },
];
