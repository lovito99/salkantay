import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { SettingsService } from './settings-service';

export type Status = 'pending' | 'active' | 'archived';
export type BulkAction = 'activate' | 'archive' | 'pending' | 'delete';

export interface RecordItem {
  id: number;
  title: string;
  description: string | null;
  status: Status;
  createdAt: string;
  updatedAt: string;
}

export interface RecordInput {
  title: string;
  description: string;
  status: Status;
}

export interface Filters {
  q: string;
  status: string;
  from: string;
  to: string;
}

export interface RecordPage {
  data: RecordItem[];
  meta: {
    page: number;
    lastPage: number;
    perPage: number;
    total: number;
    from: number | null;
    to: number | null;
  };
}

/**
 * Selección para una acción masiva:
 * - manual: los ids marcados.
 * - todos: todos los resultados del filtro, menos los desmarcados (exceptIds).
 */
export type Selection = { all: false; ids: number[] } | { all: true; exceptIds: number[] };

export const emptyFilters = (): Filters => ({ q: '', status: '', from: '', to: '' });

@Injectable({ providedIn: 'root' })
export class RecordsService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);

  private get url(): string {
    return `${this.settings.apiUrl}/records`;
  }

  list(filters: Filters, page: number, perPage: number) {
    let params = new HttpParams().set('page', page).set('perPage', perPage);

    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        params = params.set(key, value);
      }
    }

    return this.http.get<RecordPage>(this.url, { params });
  }

  create(input: RecordInput) {
    return this.http.post<{ data: RecordItem }>(this.url, input);
  }

  update(id: number, input: RecordInput) {
    return this.http.put<{ data: RecordItem }>(`${this.url}/${id}`, input);
  }

  remove(id: number) {
    return this.http.delete(`${this.url}/${id}`);
  }

  bulk(action: BulkAction, selection: Selection, filters: Filters) {
    return this.http.post<{ affected: number }>(`${this.url}/bulk`, {
      action,
      ...selection,
      filters,
    });
  }
}
