import {
  afterEveryRender, afterRenderEffect, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input,
  output, viewChild
} from '@angular/core';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import { CdkConnectedOverlay, OverlayModule } from '@angular/cdk/overlay';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { JT_GRID_LABELS } from '../labels';

export interface RowAction {
  value: string;
  label: string;
  icon: string;
  // Show as an icon in the row, not in "⋮" (the first two are taken)
  inline?: boolean;
  // Dangerous (delete, retire) — always in "⋮", red, last, after a separator
  danger?: boolean;
  disabled?: boolean;
}

// At most two icons in a row
const MAX_INLINE = 2;

/**
 * Row actions: up to two icons with a tooltip, the rest in the "⋮" menu (Aria).
 * The choice — `action` with `RowAction.value`; confirming a dangerous one is up to the page.
 */
@Component({
  selector: 'jt-row-actions',
  imports: [Menu, MenuContent, MenuItem, MenuTrigger, OverlayModule, MatIconButton, MatIcon, MatTooltip],
  templateUrl: './row-actions.component.html',
  styleUrl: './row-actions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    '[attr.aria-label]': 'labels().actions + (subject() ? ": " + subject() : "")'
  }
})
export class JtRowActionsComponent {
  protected readonly labels = inject(JT_GRID_LABELS);

  readonly actions = input.required<RowAction[]>();
  // Whose actions — for the screen-reader label of the "⋮" button
  readonly subject = input<string>();

  /**
   * Keyboard inside a grid cell (set by jt-grid): false — the buttons are out of the Tab order, the cell is one stop;
   * true — the user pressed Enter on the cell: focus goes to the first button, arrows and Tab move between buttons.
   * Outside a grid leave it unset: the buttons are ordinary Tab stops.
   */
  readonly inside = input<boolean | undefined>(undefined);
  // Escape inside — the grid takes focus back to the cell
  readonly leave = output<void>();

  readonly action = output<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  // The menu (Aria) renders in an overlay — passed to the trigger through viewChild
  protected readonly moreMenu = viewChild<Menu<string>>('moreMenu');
  private readonly overlay = viewChild(CdkConnectedOverlay);
  private resizeObserver: ResizeObserver | null = null;

  protected readonly inline = computed(() => this.actions().filter(a => a.inline && !a.danger).slice(0, MAX_INLINE));
  protected readonly menu = computed(() => this.actions().filter(a => !a.danger && !this.inline().includes(a)));
  protected readonly dangerous = computed(() => this.actions().filter(a => a.danger));

  constructor() {
    // Entered with the keyboard — focus the first button (a mouse click already put focus on its button)
    afterRenderEffect(() => {
      const focused = this.host.ownerDocument.activeElement;
      if (this.inside() && (focused === this.host || !this.host.contains(focused))) {
        this.buttons()[0]?.focus();
      }
    });
    // Buttons leave the Tab order while the cell is one grid stop. Set on the element after every render:
    // ngMenuTrigger binds its own tabindex="0" to the "⋮" button
    afterEveryRender(() => {
      const tabIndex = this.inside() === false ? '-1' : '0';
      this.host.querySelectorAll<HTMLButtonElement>(':scope > button').forEach(button => {
        if (button.getAttribute('tabindex') !== tabIndex) {
          button.setAttribute('tabindex', tabIndex);
        }
      });
    });
    inject(DestroyRef).onDestroy(() => this.stopWatching());
    // Capture phase: ngMenuTrigger handles Escape on "⋮" itself and stops it
    this.host.addEventListener('keydown', event => this.onKeydown(event), true);
  }

  private onKeydown(event: KeyboardEvent): void {
    if (!this.inside()) {
      return;
    }
    const buttons = this.buttons();
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) {
      return; // a key inside the open menu — the menu handles it
    }
    const rtl = getComputedStyle(this.host).direction === 'rtl';
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step) {
      event.preventDefault();
      event.stopPropagation();
      buttons[(index + (rtl ? -step : step) + buttons.length) % buttons.length].focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.leave.emit();
      this.host.focus();
    }
  }

  private buttons(): HTMLButtonElement[] {
    return Array.from(this.host.querySelectorAll<HTMLButtonElement>(':scope > button:not([disabled])'));
  }

  /**
   * Menu items (ngMenuContent) appear after the overlay has chosen its position: the menu is still empty then and
   * "fits" below the button, and for the bottom row it later goes past the window edge (the last item, Delete, is hidden).
   * While the menu is open, the position is chosen again on every change of its size — the menu opens above the
   * button when there is no room below.
   */
  protected watchSize(): void {
    const overlayRef = this.overlay()?.overlayRef;
    if (!overlayRef || typeof ResizeObserver === 'undefined') {
      return;
    }
    this.stopWatching();
    this.resizeObserver = new ResizeObserver(() => overlayRef.updatePosition());
    this.resizeObserver.observe(overlayRef.overlayElement);
  }

  protected stopWatching(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  protected onSelected(value: string | undefined): void {
    if (value) {
      this.action.emit(value);
    }
  }
}
