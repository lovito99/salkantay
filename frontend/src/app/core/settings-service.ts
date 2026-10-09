import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  apiUrl = '/api';

  async load(): Promise<void> {
    const response = await fetch(new URL('config.json', document.baseURI), { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('No se pudo cargar la configuración del frontend.');
    }

    const settings: { apiUrl: string } = await response.json();
    this.apiUrl = settings.apiUrl.replace(/\/$/, '');
  }
}
