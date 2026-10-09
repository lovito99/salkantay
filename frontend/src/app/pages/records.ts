import { Component, DestroyRef, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, finalize } from 'rxjs';
import { errorMessage } from '../core/http-error';
import {
  BulkAction,
  Filters,
  RecordInput,
  RecordItem,
  RecordPage,
  RecordsService,
  Selection,
  Status,
  emptyFilters,
} from '../core/records-service';

type EditorMode = 'create' | 'edit' | 'view';

@Component({
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './records.html',
})
export class RecordsPage {
  private readonly api = inject(RecordsService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;

  @ViewChild('editor', { static: true }) editor!: ElementRef<HTMLDialogElement>;

  readonly statusLabels: Record<Status, string> = {
    pending: 'Pendiente',
    active: 'Activo',
    archived: 'Archivado',
  };

  readonly actionLabels: Record<BulkAction, string> = {
    activate: 'Marcar como activos',
    pending: 'Marcar como pendientes',
    archive: 'Archivar',
    delete: 'Eliminar',
  };

  readonly bulkActions = Object.keys(this.actionLabels) as BulkAction[];

  // Estado de la página
  readonly result = signal<RecordPage | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  // Filtros y paginación
  filters: Filters = emptyFilters();
  applied: Filters = emptyFilters();
  page = 1;
  perPage = 10;

  // Selección: manual (selected) o todos los resultados menos los excluidos (excluded)
  readonly allSelected = signal(false);
  readonly selected = signal(new Set<number>());
  readonly excluded = signal(new Set<number>());
  bulkAction: BulkAction = 'activate';

  // Formulario del modal
  mode: EditorMode = 'create';
  current: RecordItem | null = null;
  input: RecordInput = this.blankInput();
  readonly formError = signal('');

  readonly rows = computed(() => this.result()?.data ?? []);
  readonly total = computed(() => this.result()?.meta.total ?? 0);
  readonly currentPage = computed(() => this.result()?.meta.page ?? 1);
  readonly lastPage = computed(() => this.result()?.meta.lastPage ?? 1);

  readonly selectionCount = computed(() =>
    this.allSelected() ? this.total() - this.excluded().size : this.selected().size,
  );

  readonly pageSelected = computed(
    () => this.rows().length > 0 && this.rows().every((row) => this.isSelected(row.id)),
  );

  readonly pagePartial = computed(
    () => !this.pageSelected() && this.rows().some((row) => this.isSelected(row.id)),
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
    this.load();
  }

  get busy(): boolean {
    return this.loading() || this.saving();
  }

  // ---------- Listado ----------

  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');

    this.request = this.api.list(this.applied, this.page, this.perPage).subscribe({
      next: (result) => {
        // Si la página quedó vacía (por ejemplo, tras eliminar), vuelve a la última.
        if (this.page > result.meta.lastPage) {
          this.page = result.meta.lastPage;
          this.load();
          return;
        }

        this.result.set(result);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(errorMessage(error));
        this.result.set(null);
        this.loading.set(false);
      },
    });
  }

  applyFilters(): void {
    if (this.filters.from && this.filters.to && this.filters.from > this.filters.to) {
      this.error.set('La fecha inicial debe ser anterior a la fecha final.');
      return;
    }

    this.applied = { ...this.filters };
    this.page = 1;
    this.clearSelection();
    this.load();
  }

  resetFilters(): void {
    this.filters = emptyFilters();
    this.applyFilters();
  }

  changePage(page: number): void {
    this.page = page;
    this.load();
  }

  changePerPage(): void {
    this.page = 1;
    this.load();
  }

  // ---------- Selección ----------

  isSelected(id: number): boolean {
    return this.allSelected() ? !this.excluded().has(id) : this.selected().has(id);
  }

  toggle(id: number): void {
    // En modo "todos", desmarcar significa excluir.
    const target = this.allSelected() ? this.excluded : this.selected;
    const ids = new Set(target());

    if (ids.has(id)) {
      ids.delete(id);
    } else {
      ids.add(id);
    }

    target.set(ids);
  }

  togglePage(): void {
    const check = !this.pageSelected();

    for (const row of this.rows()) {
      if (this.isSelected(row.id) !== check) {
        this.toggle(row.id);
      }
    }
  }

  selectAll(): void {
    this.allSelected.set(true);
    this.selected.set(new Set());
    this.excluded.set(new Set());
  }

  clearSelection(): void {
    this.allSelected.set(false);
    this.selected.set(new Set());
    this.excluded.set(new Set());
  }

  // ---------- Acción masiva ----------

  runBulk(): void {
    const count = this.selectionCount();

    if (this.busy || count === 0) {
      return;
    }

    const warning = this.bulkAction === 'delete' ? ' Esta acción no se puede deshacer.' : '';
    const label = this.actionLabels[this.bulkAction].toLowerCase();

    if (!window.confirm(`¿${label} ${count} registro(s)?${warning}`)) {
      return;
    }

    const selection: Selection = this.allSelected()
      ? { all: true, exceptIds: [...this.excluded()] }
      : { all: false, ids: [...this.selected()] };

    this.saving.set(true);
    this.error.set('');

    this.api
      .bulk(this.bulkAction, selection, this.applied)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (response) => {
          this.notice.set(`Acción completada: ${response.affected} registro(s) afectados.`);
          this.clearSelection();
          this.load();
        },
        error: (error) => this.error.set(errorMessage(error)),
      });
  }

  // ---------- CRUD ----------

  open(mode: EditorMode, record: RecordItem | null = null): void {
    this.mode = mode;
    this.current = record;
    this.formError.set('');
    this.input = record
      ? { title: record.title, description: record.description ?? '', status: record.status }
      : this.blankInput();

    this.editor.nativeElement.showModal();
  }

  close(): void {
    if (!this.saving()) {
      this.editor.nativeElement.close();
    }
  }

  onCancel(event: Event): void {
    // Evita cerrar el modal con Escape mientras se guarda.
    if (this.saving()) {
      event.preventDefault();
    }
  }

  save(): void {
    if (this.saving() || this.mode === 'view' || !this.input.title.trim()) {
      return;
    }

    const input = { ...this.input, title: this.input.title.trim() };
    const request = this.current
      ? this.api.update(this.current.id, input)
      : this.api.create(input);

    this.saving.set(true);
    this.formError.set('');

    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.editor.nativeElement.close();
          this.notice.set(this.current ? 'Registro actualizado.' : 'Registro creado.');
          this.load();
        },
        error: (error) => this.formError.set(errorMessage(error)),
      });
  }

  remove(record: RecordItem): void {
    if (this.busy || !window.confirm(`¿Eliminar “${record.title}”? Esta acción no se puede deshacer.`)) {
      return;
    }

    this.saving.set(true);
    this.error.set('');

    this.api
      .remove(record.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.notice.set('Registro eliminado.');
          this.clearSelection();
          this.load();
        },
        error: (error) => this.error.set(errorMessage(error)),
      });
  }

  private blankInput(): RecordInput {
    return { title: '', description: '', status: 'pending' };
  }
}
