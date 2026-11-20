import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RowAction, JtRowActionsComponent } from './row-actions.component';

describe('JtRowActionsComponent', () => {
  let fixture: ComponentFixture<JtRowActionsComponent>;

  const actions: RowAction[] = [
    { value: 'open', label: 'Open', icon: 'open_in_new', inline: true },
    { value: 'refresh', label: 'Refresh', icon: 'refresh', inline: true },
    { value: 'logs', label: 'Logs', icon: 'receipt_long', inline: true },
    { value: 'delete', label: 'Delete', icon: 'delete', inline: true, danger: true }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JtRowActionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(JtRowActionsComponent);
    fixture.componentRef.setInput('actions', actions);
    fixture.detectChanges();
  });

  it('shows at most two icons and never a dangerous one inline', () => {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const labels = buttons.map(b => b.getAttribute('aria-label'));

    expect(buttons.length).toBe(3);
    expect(labels.slice(0, 2)).toEqual(['Open', 'Refresh']);
    expect(labels).not.toContain('Delete');
  });

  it('emits the value of an inline action', () => {
    let chosen: string | undefined;
    fixture.componentInstance.action.subscribe(value => chosen = value);

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();

    expect(chosen).toBe('open');
  });

  describe('inside a grid cell', () => {
    const buttons = () => Array.from(fixture.nativeElement.querySelectorAll(':scope > button')) as HTMLButtonElement[];
    const key = (target: HTMLElement, k: string) =>
      target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

    beforeEach(() => {
      document.body.appendChild(fixture.nativeElement);
      // in jt-grid ngGridCellWidget gives the host its tabindex
      fixture.nativeElement.tabIndex = -1;
      fixture.componentRef.setInput('inside', false);
      fixture.detectChanges();
    });

    it('keeps its buttons out of the Tab order until entered', () => {
      expect(buttons().map(b => b.tabIndex)).toEqual([-1, -1, -1]);
    });

    it('focuses the first button on enter, moves with arrows and leaves on Escape', () => {
      let left = false;
      fixture.componentInstance.leave.subscribe(() => left = true);

      fixture.componentRef.setInput('inside', true);
      fixture.detectChanges();
      TestBed.tick();
      expect(document.activeElement).toBe(buttons()[0]);
      expect(buttons().map(b => b.tabIndex)).toEqual([0, 0, 0]);

      key(buttons()[0], 'ArrowRight');
      expect(document.activeElement).toBe(buttons()[1]);
      key(buttons()[1], 'ArrowLeft');
      key(buttons()[0], 'ArrowLeft');
      expect(document.activeElement).toBe(buttons()[2]);

      key(buttons()[2], 'Escape');
      expect(left).toBe(true);
      expect(document.activeElement).toBe(fixture.nativeElement);
    });

    it('names the group after its row', () => {
      fixture.componentRef.setInput('subject', 'web-001');
      fixture.detectChanges();
      expect(fixture.nativeElement.getAttribute('role')).toBe('group');
      expect(fixture.nativeElement.getAttribute('aria-label')).toBe('Actions: web-001');
    });
  });
});
