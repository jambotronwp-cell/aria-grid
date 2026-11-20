import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, concatMap, EMPTY, finalize, from, map, Observable, of, switchMap, tap, toArray } from 'rxjs';
import { JT_GRID_LABELS } from '../labels';
import { JtGridDialogComponent, JtGridDialogData } from './grid-dialogs.component';

export interface JtGridBulkRun<T> {
  rows: T[];
  // Title of the confirmation and label of its button — the action name ("Delete")
  label: string;
  // Confirmation text; without it the action runs without asking (safe actions)
  confirm?: string;
  danger?: boolean;
  // Ask for a reason (one for all rows, required) instead of a plain confirmation; the text is `confirm`
  reason?: boolean;
  // Action on one row (with the reason, if asked); a failed row does not stop the others
  run: (row: T, reason: string) => Observable<unknown>;
}

export interface JtGridBulkResult<T> {
  done: T[];
  failed: T[];
}

/** A bulk action that is running: the grid shows it in its bulk bar (label, rows done of total) and locks the actions. */
export interface JtGridBulkProgress {
  label: string;
  done: number;
  total: number;
}

/**
 * How the bulk service talks to the user. The default uses a Material dialog and snack bar;
 * an app passes its own (its confirm dialog, its toasts) with { provide: JT_GRID_BULK_UI, useValue: ... }.
 */
export interface JtGridBulkUi {
  // Resolves with the reason ('' when no reason was asked) or null when cancelled
  ask: (request: JtGridDialogData) => Observable<string | null>;
  success: (message: string) => void;
  error: (message: string) => void;
}

export const JT_GRID_BULK_UI = new InjectionToken<JtGridBulkUi>('JT_GRID_BULK_UI', {
  providedIn: 'root',
  factory: () => {
    const dialog = inject(MatDialog);
    const snackBar = inject(MatSnackBar);
    return {
      ask: request => dialog.open<JtGridDialogComponent, JtGridDialogData, string>(JtGridDialogComponent, {
        data: request, width: '520px', maxWidth: '95vw'
      }).afterClosed().pipe(map(reason => reason ?? null)),
      success: message => snackBar.open(message, undefined, { duration: 4000 }),
      error: message => snackBar.open(message, undefined, { duration: 8000 })
    };
  }
});

/**
 * Bulk action of the grid: one confirmation for all rows ("Delete: 5?"), rows run one after another,
 * the outcome is one message "done N, failed M". Cancelled — nothing happens (the stream completes without a value).
 */
@Injectable({ providedIn: 'root' })
export class JtGridBulkService {
  private readonly ui = inject(JT_GRID_BULK_UI);
  private readonly labels = inject(JT_GRID_LABELS);
  private readonly progressState = signal<JtGridBulkProgress | null>(null);

  /** The running bulk action, null when none: rows run one after another and can take seconds each. */
  readonly progress = this.progressState.asReadonly();

  run<T>(bulk: JtGridBulkRun<T>): Observable<JtGridBulkResult<T>> {
    const title = `${bulk.label}: ${bulk.rows.length}`;
    const asked: Observable<string | null> = bulk.reason || bulk.confirm
      ? this.ui.ask({ title, message: bulk.confirm ?? '', confirmLabel: bulk.label, danger: bulk.danger, reason: bulk.reason })
      : of('');
    // Cancelled — EMPTY: no result at all, so callers do not reload for nothing
    return asked.pipe(
      switchMap(reason => {
        if (reason === null) {
          return EMPTY;
        }
        let finished = 0;
        this.progressState.set({ label: bulk.label, done: 0, total: bulk.rows.length });
        return from(bulk.rows).pipe(
          concatMap(row => bulk.run(row, reason).pipe(
            map(() => ({ row, ok: true })),
            catchError(() => of({ row, ok: false })))),
          tap(() => this.progressState.set({ label: bulk.label, done: ++finished, total: bulk.rows.length })),
          toArray(),
          finalize(() => this.progressState.set(null))
        );
      }),
      map(results => {
        const labels = this.labels();
        const done = results.filter(r => r.ok).map(r => r.row);
        const failed = results.filter(r => !r.ok).map(r => r.row);
        // One message for the whole run: a toast service that shows one message at a time would hide the other
        if (failed.length) {
          this.ui.error(`${bulk.label}: ${labels.done} ${done.length}, ${labels.failed} ${failed.length}`);
        } else if (done.length) {
          this.ui.success(`${bulk.label}: ${labels.done} ${done.length}`);
        }
        return { done, failed };
      })
    );
  }
}
