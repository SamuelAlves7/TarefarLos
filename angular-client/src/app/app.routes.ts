import { Routes } from '@angular/router';
import { BoardPageComponent } from './features/board/board-page.component';
import { DashboardPageComponent } from './features/dashboard/dashboard-page.component';
import { TasksPageComponent } from './features/tasks/tasks-page.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DashboardPageComponent },
  { path: 'tarefas', component: TasksPageComponent },
  { path: 'lousa', component: BoardPageComponent },
  { path: '**', redirectTo: 'dashboard' },
];
