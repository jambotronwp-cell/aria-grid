import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle
} from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatHint, MatInput, MatLabel } from '@angular/material/input';
import { JT_GRID_LABELS } from '../labels';

export interface JtGridDialogData {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  // true — ask for a reason (required, one for all selected rows); the dialog closes with it
  reason?: boolean;
}

const REASON_MAX = 500;

/** Default confirmation for a bulk action: plain "are you sure", or a required reason (moderation). */
@Component({
  selector: 'jt-grid-dialog',
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatButton, MatFormField, MatLabel, MatHint, MatInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      @if (data.message) {
        <p>{{ data.message }}</p>
      }
      @if (data.reason) {
        <mat-form-field class="reason">
          <mat-label>{{ labels().reason }}</mat-label>
          <textarea matInput rows="3" required [attr.maxlength]="max" cdkFocusInitial
                    [value]="reason()" (input)="reason.set($any($event.target).value)"></textarea>
          <mat-hint align="end">{{ reason().length }} / {{ max }}</mat-hint>
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>{{ labels().cancel }}</button>
      <button matButton="filled" type="button" class="confirm" [class.jt-danger]="data.danger" [disabled]="!valid()" (click)="confirm()">
        {{ data.confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `.reason { width: 100%; }`
})
export class JtGridDialogComponent {
  protected readonly data = inject<JtGridDialogData>(MAT_DIALOG_DATA);
  protected readonly labels = inject(JT_GRID_LABELS);
  private readonly dialogRef = inject(MatDialogRef<JtGridDialogComponent, string>);
  protected readonly max = REASON_MAX;
  protected readonly reason = signal('');
  protected readonly valid = computed(() => !this.data.reason || this.reason().trim().length > 0);

  protected confirm(): void {
    if (this.valid()) {
      this.dialogRef.close(this.data.reason ? this.reason().trim() : '');
    }
  }
}
