import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { CreateTaskPayload, Task } from '../../core/models/app.models';
import { TaskStoreService } from '../../core/services/task-store.service';
import { TaskFormModalComponent } from '../../shared/task-form-modal/task-form-modal.component';
import { TaskViewModalComponent } from '../../shared/task-view-modal/task-view-modal.component';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [CommonModule, TaskFormModalComponent, TaskViewModalComponent],
  templateUrl: './tasks-page.component.html',
  styleUrl: './tasks-page.component.css',
})
export class TasksPageComponent {
  readonly taskStore = inject(TaskStoreService);

  readonly formOpen = signal(false);
  readonly viewOpen = signal(false);
  readonly draftTask = signal<Task | null>(null);
  readonly selectedTask = signal<Task | null>(null);
  readonly collapsedProjects = signal<Record<string, boolean>>({});

  readonly groupedProjects = computed(() => {
    const groups = new Map<string, Task[]>();
    for (const task of this.taskStore.tasks()) {
      const key = task.projeto.trim();
      const list = groups.get(key) ?? [];
      list.push(task);
      groups.set(key, list);
    }

    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
      .map(([name, tasks]) => ({
        name,
        tasks: [...tasks].sort((a, b) => +new Date(b.criadaEm) - +new Date(a.criadaEm)),
      }));
  });

  constructor() {
    void this.taskStore.load();
  }

  openCreate(): void {
    this.draftTask.set(null);
    this.formOpen.set(true);
  }

  openView(task: Task): void {
    this.selectedTask.set(task);
    this.viewOpen.set(true);
  }

  openDuplicate(task: Task): void {
    this.viewOpen.set(false);
    this.draftTask.set(task);
    this.formOpen.set(true);
  }

  async createTask(payload: CreateTaskPayload): Promise<void> {
    await this.taskStore.create(payload);
    this.formOpen.set(false);
    this.draftTask.set(null);
  }

  async deleteTask(task: Task): Promise<void> {
    if (!confirm(`Excluir a tarefa "${task.titulo}"?`)) return;
    await this.taskStore.delete(task.id);
    this.viewOpen.set(false);
    this.selectedTask.set(null);
  }

  async clearTasks(): Promise<void> {
    if (!confirm('Deseja remover todas as tarefas?')) return;
    await this.taskStore.clear();
  }

  async toggleInProgress(task: Task): Promise<void> {
    const next = !task.emExecucao;
    await this.taskStore.updateStatus(task.id, {
      emExecucao: next,
      concluida: next ? false : task.concluida,
    });
  }

  async toggleDone(task: Task): Promise<void> {
    const next = !task.concluida;
    await this.taskStore.updateStatus(task.id, {
      concluida: next,
      emExecucao: next ? false : task.emExecucao,
    });
  }

  toggleProject(name: string): void {
    this.collapsedProjects.update((state) => ({
      ...state,
      [name]: !state[name],
    }));
  }

  expandAll(): void {
    this.collapsedProjects.set({});
  }

  collapseAll(): void {
    const next: Record<string, boolean> = {};
    for (const group of this.groupedProjects()) {
      next[group.name] = true;
    }
    this.collapsedProjects.set(next);
  }

  isCollapsed(name: string): boolean {
    return !!this.collapsedProjects()[name];
  }

  statusLabel(task: Task): string {
    if (task.concluida) return 'Concluida';
    if (task.emExecucao) return 'Em execucao';
    return 'Pendente';
  }

  statusClass(task: Task): string {
    if (task.concluida) return 'status-concluida';
    if (task.emExecucao) return 'status-execucao';
    return 'status-pendente';
  }
}
