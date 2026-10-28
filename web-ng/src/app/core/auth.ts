import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { UserDTO } from '@shared/types';
import { Api, ApiError } from './api';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  readonly user = signal<UserDTO | null>(null);
  readonly loading = signal(true);

  /** Roda antes da primeira rota (provideAppInitializer). */
  async init(): Promise<void> {
    try {
      const { user } = await this.api.me();
      this.user.set(user);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        console.warn('Falha ao verificar sessão', error);
      }
    } finally {
      this.loading.set(false);
    }
  }

  async login(email: string, password: string): Promise<void> {
    const { user } = await this.api.login(email, password);
    this.user.set(user);
  }

  async register(name: string, email: string, password: string): Promise<void> {
    const { user } = await this.api.register(name, email, password);
    this.user.set(user);
  }

  async demo(): Promise<void> {
    const { user } = await this.api.demo();
    this.user.set(user);
  }

  async logout(): Promise<void> {
    try {
      await this.api.logout();
    } finally {
      this.user.set(null);
      await this.router.navigate(['/login']);
    }
  }

  async updateName(name: string): Promise<void> {
    const { user } = await this.api.updateProfile(name);
    this.user.set(user);
  }
}
