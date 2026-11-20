import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JtGridBulkEvent, JtGridCellDirective, JtGridColumn, JtGridComponent } from './jt-grid.component';
import { RowAction } from '../row-actions/row-actions.component';

interface Item {
  id: number;
  name: string;
  size: number;
}

@Component({
  imports: [JtGridComponent, JtGridCellDirective],
  template: `
    <jt-grid [rows]="rows()" [columns]="columns" [trackBy]="byId" [bulkActions]="bulk" [pageSize]="10" [pager]="pager()"
                 (bulkAction)="lastBulk = $event">
      <ng-template jtGridCell="name" let-row><b class="name">{{ row.name }}</b></ng-template>
    </jt-grid>`
})
class HostComponent {
  readonly rows = signal<Item[]>([]);
  readonly pager = signal<'auto' | 'always'>('auto');
  readonly columns: JtGridColumn<Item>[] = [
    { key: 'name', label: 'Name', sort: item => item.name },
    { key: 'size', label: 'Size', sort: item => item.size, align: 'end' }
  ];
  readonly byId = (item: Item) => item.id;
  readonly bulk: RowAction[] = [{ value: 'delete', label: 'Delete', icon: 'delete', danger: true }];
  lastBulk: JtGridBulkEvent<Item> | null = null;
}

const items = (n: number): Item[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, name: 'item ' + (i + 1), size: (i * 7) % 13 }));

// The grid
describe('JtGridComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  const element = () => fixture.nativeElement as HTMLElement;
  const names = () => Array.from(element().querySelectorAll('tbody .name')).map(cell => cell.textContent);
  const set = (rows: Item[]) => {
    fixture.componentInstance.rows.set(rows);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders cells from templates and pages the rows', () => {
    set(items(23));
    expect(names().length).toBe(10);
    expect(element().querySelector('.pager-range')?.textContent).toContain('1–10');

    const next = element().querySelectorAll<HTMLButtonElement>('.pager-buttons button')[2];
    next.click();
    fixture.detectChanges();
    expect(names()[0]).toBe('item 11');
  });

  it('hides the pager for a short list unless asked to show it always', () => {
    set(items(3));
    expect(element().querySelector('.pager')).toBeNull();

    fixture.componentInstance.pager.set('always');
    fixture.detectChanges();
    expect(element().querySelector('.pager-range')?.textContent).toContain('1–3');
    expect(element().querySelector('.pager-range')?.textContent).toContain('3');
  });

  it('sorts ascending, descending, then back to the original order', () => {
    set(items(5));
    const header = () => element().querySelectorAll<HTMLButtonElement>('th button.sort')[1];

    header().click();
    fixture.detectChanges();
    expect(element().querySelectorAll('th')[2].getAttribute('aria-sort')).toBe('ascending');
    const asc = names();

    header().click();
    fixture.detectChanges();
    expect(names()).toEqual([...asc].reverse());

    header().click();
    fixture.detectChanges();
    expect(names()).toEqual(['item 1', 'item 2', 'item 3', 'item 4', 'item 5']);
  });

  it('selects rows, shows the bulk bar and emits the selected rows', () => {
    set(items(3));
    expect(element().querySelector('.bulk-bar')).toBeNull();

    const boxes = element().querySelectorAll<HTMLInputElement>('tbody input[type=checkbox]');
    boxes[0].click();
    boxes[2].click();
    fixture.detectChanges();
    expect(element().querySelector('.bulk-bar')?.textContent).toContain('2');

    element().querySelector<HTMLButtonElement>('.bulk-action')!.click();
    expect(fixture.componentInstance.lastBulk?.action).toBe('delete');
    expect(fixture.componentInstance.lastBulk?.rows.map(r => r.id)).toEqual([1, 3]);
  });

  it('select all takes every row and drops rows that are gone after a reload', () => {
    set(items(15));
    element().querySelector<HTMLInputElement>('thead input[type=checkbox]')!.click();
    fixture.detectChanges();
    expect(element().querySelector('.bulk-bar')?.textContent).toContain('15');

    set(items(4));
    fixture.detectChanges();
    expect(element().querySelector('.bulk-bar')?.textContent).toContain('4');
  });

  // Keyboard: sort buttons and checkboxes are the cells' widgets — the table is a single Tab stop, arrows move inside
  it('is one Tab stop: controls inside cells are out of the Tab order', () => {
    set(items(12));
    const stops = Array.from(element().querySelectorAll<HTMLElement>('table button, table input, table [tabindex]'))
      .filter(el => el.tabIndex >= 0);
    expect(stops.length).toBe(1);
    expect(stops[0].getAttribute('aria-label')).toBe('Select all');
  });
});
