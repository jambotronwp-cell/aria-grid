import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, input, linkedSignal, model, signal, viewChild } from '@angular/core';
import { Combobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import { OverlayModule } from '@angular/cdk/overlay';
import { MatIcon } from '@angular/material/icon';

export interface JtSelectOption<T> {
  value: T;
  label: string;
  disabled?: boolean;
}

/**
 * Dropdown of the design system on Angular Aria: combobox (no typing) + listbox in a CDK Overlay.
 * The value is a model(): [(value)] in the template; works with Signal Forms (FormValueControl: value, disabled).
 *
 * <jt-select label="Status" [options]="statusOptions" [(value)]="status" />
 */
@Component({
  selector: 'jt-select',
  imports: [Combobox, ComboboxPopup, ComboboxWidget, Listbox, Option, OverlayModule, MatIcon],
  templateUrl: './jt-select.component.html',
  styleUrl: './jt-select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.jt-select--disabled]': 'disabled()'
  }
})
export class JtSelectComponent<T> {
  readonly options = input.required<JtSelectOption<T>[]>();
  readonly value = model<T | null>(null);
  readonly label = input('');
  readonly placeholder = input('');
  readonly disabled = input(false);

  protected readonly expanded = signal(false);
  protected readonly listbox = viewChild(Listbox);

  // Listbox works with a list of values; a select has one value
  protected readonly selected = linkedSignal<T[]>(() => {
    const value = this.value();
    return value === null ? [] : [value];
  });

  protected readonly selectedLabel = computed(() => {
    const value = this.value();
    return this.options().find(option => option.value === value)?.label ?? null;
  });

  constructor() {
    afterRenderEffect(() => {
      if (this.expanded()) {
        this.listbox()?.scrollActiveItemIntoView();
      }
    });
  }

  protected commit(): void {
    const [value] = this.selected();
    if (value !== undefined) {
      this.value.set(value);
    }
    this.expanded.set(false);
  }
}
