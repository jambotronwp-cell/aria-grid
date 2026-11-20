import { InjectionToken, Provider } from '@angular/core';

/** Every text the grid shows. English by default; an app passes its own with provideJtGridLabels(). */
export interface JtGridLabels {
  actions: string;
  moreActions: string;
  selectAll: string;
  selectRow: string;
  selected: string;
  bulkActions: string;
  clearSelection: string;
  pages: string;
  of: string;
  pageSize: string;
  first: string;
  previous: string;
  next: string;
  last: string;
  done: string;
  failed: string;
  cancel: string;
  reason: string;
}

export const JT_GRID_DEFAULT_LABELS: JtGridLabels = {
  actions: 'Actions',
  moreActions: 'More actions',
  selectAll: 'Select all',
  selectRow: 'Select',
  selected: 'Selected',
  bulkActions: 'Actions for selected rows',
  clearSelection: 'Clear selection',
  pages: 'Pages',
  of: 'of',
  pageSize: 'Rows per page',
  first: 'First page',
  previous: 'Previous page',
  next: 'Next page',
  last: 'Last page',
  done: 'done',
  failed: 'failed',
  cancel: 'Cancel',
  reason: 'Reason'
};

/**
 * Labels of the grid. A function is read on every change detection, so it may follow the app's current language:
 * provideJtGridLabels(() => ({ selectAll: translate('grid.selectAll'), ... })).
 */
export const JT_GRID_LABELS = new InjectionToken<() => JtGridLabels>('JT_GRID_LABELS', {
  providedIn: 'root',
  factory: () => () => JT_GRID_DEFAULT_LABELS
});

export function provideJtGridLabels(labels: Partial<JtGridLabels> | (() => Partial<JtGridLabels>)): Provider {
  const read = typeof labels === 'function' ? labels : () => labels;
  return { provide: JT_GRID_LABELS, useValue: () => ({ ...JT_GRID_DEFAULT_LABELS, ...read() }) };
}
