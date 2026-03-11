import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BoardElement } from '../models/app.models';

declare global {
  interface Window {
    APP_CONFIG?: { apiBaseUrl?: string };
  }
}

@Injectable({ providedIn: 'root' })
export class BoardStoreService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = (window.APP_CONFIG?.apiBaseUrl ?? '').replace(/\/+$/, '');

  readonly elements = signal<BoardElement[]>([]);

  async load(): Promise<void> {
    const data = await firstValueFrom(this.http.get<{ elements: BoardElement[] }>(`${this.apiBase}/api/board`));
    this.elements.set(data.elements ?? []);
  }

  async save(elements: BoardElement[]): Promise<void> {
    this.elements.set(elements);
    await firstValueFrom(this.http.put(`${this.apiBase}/api/board`, { elements }));
  }
}
