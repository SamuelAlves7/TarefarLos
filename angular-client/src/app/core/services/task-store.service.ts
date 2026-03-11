import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CreateTaskPayload, Task, TaskStatusPayload } from '../models/app.models';

declare global {
  interface Window {
    APP_CONFIG?: { apiBaseUrl?: string };
  }
}

@Injectable({ providedIn: 'root' })
export class TaskStoreService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = (window.APP_CONFIG?.apiBaseUrl ?? '').replace(/\/+$/, '');

  readonly tasks = signal<Task[]>([]);
  readonly loading = signal(false);
  readonly projectNames = computed(() =>
    [...new Set(this.tasks().map((task) => task.projeto.trim()))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  );

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const tasks = await firstValueFrom(this.http.get<Task[]>(`${this.apiBase}/api/tasks`));
      this.tasks.set(tasks);
    } finally {
      this.loading.set(false);
    }
  }

  async create(payload: CreateTaskPayload): Promise<void> {
    await firstValueFrom(this.http.post<Task>(`${this.apiBase}/api/tasks`, payload));
    await this.load();
  }

  async updateStatus(taskId: string, payload: TaskStatusPayload): Promise<void> {
    await firstValueFrom(this.http.patch<Task>(`${this.apiBase}/api/tasks/${encodeURIComponent(taskId)}/status`, payload));
    await this.load();
  }

  async delete(taskId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/api/tasks/${encodeURIComponent(taskId)}`));
    await this.load();
  }

  async clear(): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/api/tasks`));
    await this.load();
  }
}
