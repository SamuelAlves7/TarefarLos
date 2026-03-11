import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';

type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'theme.v1';
  readonly theme = signal<ThemeMode>(this.readStoredTheme());

  constructor() {
    effect(() => {
      this.document.body.setAttribute('data-theme', this.theme());
    });
  }

  toggle(): void {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    localStorage.setItem(this.storageKey, next);
    this.theme.set(next);
  }

  private readStoredTheme(): ThemeMode {
    const stored = localStorage.getItem(this.storageKey);
    return stored === 'dark' ? 'dark' : 'light';
  }
}
