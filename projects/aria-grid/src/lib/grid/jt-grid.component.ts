import {
  ChangeDetectionStrategy, Component, computed, contentChildren, Directive, effect, inject, input, linkedSignal, output,
  signal, TemplateRef
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Grid, GridCell, GridCellWidget, GridRow } from '@angular/aria/grid';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { RowAction, JtRowActionsComponent } from '../row-actions/row-actions.component';
import { JtSelectComponent, JtSelectOption } from '../select/jt-select.component';
import { JT_GRID_LABELS } from '../labels';
import { JtGridBulkService } from '../bulk/grid-bulk.service';
import { MatProgressBar } from '@angular/material/progress-bar';

/** A grid column. sort — the value to sort by (none — the column is not sortable); the cell — template jtGridCell="key". */
export interface JtGridColumn<T> {
  key: string;
  label: string;
  sort?: (row: T) => string | number | boolean | Date | null | undefined;
  align?: 'start' | 'end';
  // A column without a visible header (icon, actions) — the header is for screen readers only
  hiddenLabel?: boolean;
}

export type JtGridSort = { key: string; direction: 'asc' | 'desc' } | null;

export interface JtGridBulkEvent<T> {
  action: string;
  rows: T[];
}

export interface JtGridRowEvent<T> {
  action: string;
  row: T;
}

/** Cell template: <ng-template jtGridCell="name" let-row>{{ row.name }}</ng-template> */
@Directive({ selector: 'ng-template[jtGridCell]' })
export class JtGridCellDirective {
  readonly key = input.required<string>({ alias: 'jtGridCell' });
  readonly template = inject(TemplateRef<{ $implicit: any }>);
}

const PAGE_SIZES = [10, 25, 50, 100];
// Wave of appearing rows: the delay stops growing after this row
const STAGGER_MAX = 12;

/**
 * The grid: sorting, pages, row selection and bulk actions, row actions — jt-row-actions.
 * All data is on the client (admin lists are small). The table is an Aria grid (.jt-table).
 * Animations: rows appear in a wave, the sort arrow turns, the selection bar slides in;
 * with prefers-reduced-motion — no motion.
 *
 * <jt-grid [rows]="users()" [columns]="columns" [trackBy]="byId" [bulkActions]="bulk" (bulkAction)="onBulk($event)"
 *              [rowActions]="actionsOf" (rowAction)="onRow($event)">
 *   <ng-template jtGridCell="name" let-row>{{ row.name }}</ng-template>
 * </jt-grid>
 */
@Component({
  selector: 'jt-grid',
  imports: [NgTemplateOutlet, Grid, GridRow, GridCell, GridCellWidget, MatButton, MatIconButton, MatCheckbox, MatIcon, MatTooltip,
    JtRowActionsComponent, JtSelectComponent, MatProgressBar],
  templateUrl: './jt-grid.component.html',
  styleUrl: './jt-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JtGridComponent<T> {
  protected readonly labels = inject(JT_GRID_LABELS);
  // A bulk action of this app is running (JtGridBulkService): progress in the bulk bar, actions locked
  protected readonly bulkProgress = inject(JtGridBulkService).progress;

  readonly rows = input.required<T[]>();
  readonly columns = input.required<JtGridColumn<T>[]>();
  readonly trackBy = input.required<(row: T) => string | number>();
  readonly label = input('');
  readonly emptyMessage = input('');
  // Actions on selected rows; empty — no selection column
  readonly bulkActions = input<RowAction[]>([]);
  // Row actions (up to two icons and "⋮"); none — no actions column
  readonly rowActions = input<((row: T) => RowAction[]) | null>(null);
  // The row's subject for the actions menu label ("Actions: <subject>")
  readonly rowSubject = input<((row: T) => string) | null>(null);
  // Highlight a row (its panel is open, the current one) — not the same as selection
  readonly highlight = input<((row: T) => boolean) | null>(null);
  readonly initialSort = input<JtGridSort>(null);
  readonly pageSize = input(25);
  // 'auto' — the pager only when there are more rows than the smallest page size;
  // 'always' — always: "1–3 of 3" replaces a separate counter above the grid
  readonly pager = input<'auto' | 'always'>('auto');

  readonly bulkAction = output<JtGridBulkEvent<T>>();
  readonly rowAction = output<JtGridRowEvent<T>>();

  private readonly cellDefs = contentChildren(JtGridCellDirective);
  protected readonly cells = computed(() => {
    const map = new Map<string, TemplateRef<{ $implicit: any }>>();
    this.cellDefs().forEach(def => map.set(def.key(), def.template));
    return map;
  });

  protected readonly sort = linkedSignal<JtGridSort>(() => this.initialSort());
  protected readonly size = linkedSignal(() => this.pageSize());
  protected readonly page = signal(0);
  // Selection is by row key: it survives sorting, paging and data reloads
  protected readonly selectedKeys = signal<ReadonlySet<string | number>>(new Set());

  protected readonly selectable = computed(() => this.bulkActions().length > 0);
  protected readonly hasRowActions = computed(() => this.rowActions() !== null);
  protected readonly sizeOptions: JtSelectOption<number>[] = PAGE_SIZES.map(n => ({ value: n, label: String(n) }));

  protected readonly sorted = computed(() => {
    const rows = [...this.rows()];
    const sort = this.sort();
    const column = sort && this.columns().find(c => c.key === sort.key);
    if (!sort || !column?.sort) {
      return rows;
    }
    const value = column.sort;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return rows.sort((a, b) => factor * compare(value(a), value(b)));
  });

  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.sorted().length / this.size())));
  protected readonly visible = computed(() => {
    const start = this.page() * this.size();
    return this.sorted().slice(start, start + this.size());
  });
  protected readonly range = computed(() => {
    const total = this.sorted().length;
    const from = total === 0 ? 0 : this.page() * this.size() + 1;
    return { from, to: Math.min(total, (this.page() + 1) * this.size()), total };
  });

  protected readonly selectedRows = computed(() => {
    const keys = this.selectedKeys();
    const key = this.trackBy();
    return this.rows().filter(row => keys.has(key(row)));
  });
  protected readonly allSelected = computed(() => this.rows().length > 0 && this.selectedRows().length === this.rows().length);
  protected readonly someSelected = computed(() => this.selectedRows().length > 0 && !this.allSelected());

  constructor() {
    // Fewer rows now (filter, delete) — the page does not go past the end; rows that left are unselected
    effect(() => {
      if (this.page() > this.pages() - 1) {
        this.page.set(this.pages() - 1);
      }
    });
    effect(() => {
      const key = this.trackBy();
      const present = new Set(this.rows().map(key));
      const keys = this.selectedKeys();
      if ([...keys].some(k => !present.has(k))) {
        this.selectedKeys.set(new Set([...keys].filter(k => present.has(k))));
      }
    });
  }

  protected toggleSort(column: JtGridColumn<T>): void {
    if (!column.sort) {
      return;
    }
    const sort = this.sort();
    // In a circle: ascending → descending → original order
    if (sort?.key !== column.key) {
      this.sort.set({ key: column.key, direction: 'asc' });
    } else if (sort.direction === 'asc') {
      this.sort.set({ key: column.key, direction: 'desc' });
    } else {
      this.sort.set(null);
    }
    this.page.set(0);
  }

  protected ariaSort(column: JtGridColumn<T>): string | null {
    if (!column.sort) {
      return null;
    }
    const sort = this.sort();
    return sort?.key === column.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';
  }

  protected setSize(size: number | null): void {
    this.size.set(size ?? this.pageSize());
    this.page.set(0);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(page, 0), this.pages() - 1));
  }

  protected isSelected(row: T): boolean {
    return this.selectedKeys().has(this.trackBy()(row));
  }

  protected toggleRow(row: T, checked: boolean): void {
    const key = this.trackBy()(row);
    this.selectedKeys.update(keys => {
      const next = new Set(keys);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  // "Select all" — every row of the list, not just the page: a bulk action is usually meant for all
  protected toggleAll(checked: boolean): void {
    const key = this.trackBy();
    this.selectedKeys.set(checked ? new Set(this.rows().map(key)) : new Set());
  }

  protected clearSelection(): void {
    this.selectedKeys.set(new Set());
  }

  protected runBulk(action: RowAction): void {
    const rows = this.selectedRows();
    if (rows.length > 0 && !action.disabled && !this.bulkProgress()) {
      this.bulkAction.emit({ action: action.value, rows });
    }
  }

  protected isHighlighted(row: T): boolean {
    return this.highlight()?.(row) ?? false;
  }

  protected actionsOf(row: T): RowAction[] {
    return this.rowActions()?.(row) ?? [];
  }

  protected subjectOf(row: T): string | undefined {
    return this.rowSubject()?.(row);
  }

  protected selectRowLabel(row: T): string {
    const subject = this.subjectOf(row);
    return this.labels().selectRow + (subject ? ': ' + subject : '');
  }

  // Focus of a checkbox cell goes to the <input> inside mat-checkbox
  protected readonly checkboxInput = (host: HTMLElement) => host.querySelector<HTMLInputElement>('input');

  protected stagger(index: number): number {
    return Math.min(index, STAGGER_MAX);
  }
}

function compare(a: unknown, b: unknown): number {
  // Empty values always go last when ascending
  const emptyA = a === null || a === undefined || a === '';
  const emptyB = b === null || b === undefined || b === '';
  if (emptyA || emptyB) {
    return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return Number(a) - Number(b);
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}
