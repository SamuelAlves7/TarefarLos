import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TaskStoreService } from '../../core/services/task-store.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.css',
})
export class DashboardPageComponent {
  readonly taskStore = inject(TaskStoreService);

  readonly summary = computed(() => {
    const tasks = this.taskStore.tasks();
    return {
      total: tasks.length,
      pendentes: tasks.filter((task) => !task.emExecucao && !task.concluida).length,
      execucao: tasks.filter((task) => task.emExecucao).length,
      concluidas: tasks.filter((task) => task.concluida).length,
    };
  });

  readonly recentTasks = computed(() =>
    [...this.taskStore.tasks()]
      .sort((a, b) => +new Date(b.criadaEm) - +new Date(a.criadaEm))
      .slice(0, 5),
  );

  constructor() {
    if (!this.taskStore.tasks().length) {
      void this.taskStore.load();
    }
  }
}
