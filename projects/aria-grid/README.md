# @jambotron/aria-grid

Angular data grid built on [Angular Aria](https://angular.dev/guide/aria/overview) `grid`: sorting, paging,
row selection with "select all", bulk actions, row actions (up to two icons + a "⋮" menu), row highlight,
row/sort/selection animations (off under `prefers-reduced-motion`).

Data is fully client-side — meant for admin lists of hundreds, not millions, of rows.

## Requirements

Angular 22 with `@angular/aria`, `@angular/cdk`, `@angular/material` (peer dependencies, same major).

## Install

```bash
npm install @jambotron/aria-grid
```

Global styles (once):

```scss
@use '@jambotron/aria-grid/styles/aria-grid';
```

## Use

```ts
import { JtGridComponent, JtGridCellDirective, JtGridColumn, RowAction } from '@jambotron/aria-grid';

columns: JtGridColumn<User>[] = [
  { key: 'name', label: 'Name', sort: u => u.name },
  { key: 'created', label: 'Created', sort: u => u.created, align: 'end' }
];
bulk: RowAction[] = [{ value: 'delete', label: 'Delete', icon: 'delete', danger: true }];
actionsOf = (u: User): RowAction[] => [
  { value: 'open', label: 'Open', icon: 'open_in_new', inline: true },
  { value: 'delete', label: 'Delete', icon: 'delete', danger: true }
];
byId = (u: User) => u.id;
```

```html
<jt-grid [rows]="users()" [columns]="columns" [trackBy]="byId" label="Users"
         [bulkActions]="bulk" (bulkAction)="onBulk($event)"
         [rowActions]="actionsOf" (rowAction)="onRow($event)">
  <ng-template jtGridCell="name" let-row>{{ row.name }}</ng-template>
  <ng-template jtGridCell="created" let-row>{{ row.created | date }}</ng-template>
</jt-grid>
```

Inputs: `rows`, `columns`, `trackBy` (required); `label`, `emptyMessage`, `bulkActions` (empty — no selection column),
`rowActions` (null — no actions column), `rowSubject`, `highlight`, `initialSort`, `pageSize` (10/25/50/100, default 25).
Outputs: `bulkAction` `{ action, rows }`, `rowAction` `{ action, row }`.
Selection is kept by row key across sorting, paging and data reloads.

## Bulk actions

`JtGridBulkService` asks once for all rows, runs them one by one (a failed row does not stop the rest) and reports
"done N" / "failed M":

```ts
onBulk(e: JtGridBulkEvent<User>) {
  this.bulk.run({
    rows: e.rows, label: 'Delete', confirm: 'Delete the selected users?', danger: true,
    run: u => this.api.delete(u.id)
  }).subscribe(() => this.reload());
}
```

`reason: true` asks for one required reason for all rows (passed as the second argument of `run`).
Cancelled — the stream completes without a value. By default the service uses a Material dialog and snack bar;
plug in your own confirm dialog and toasts:

```ts
{ provide: JT_GRID_BULK_UI, useValue: { ask: req => myConfirm(req), success: m => toast.ok(m), error: m => toast.err(m) } }
```

## Keyboard

The table is one Tab stop ([WAI-ARIA grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)):

- **Tab** enters the table, **arrows** move between cells, **Home**/**End** — first/last cell of the row,
  **Ctrl+Home**/**Ctrl+End** — first/last cell of the table; the next **Tab** leaves the table;
- a sortable header: the arrows land on its sort button, **Enter** or **Space** sorts;
- a checkbox cell: the arrows land on the checkbox, **Space** toggles it;
- the actions cell is one stop for all its buttons: **Enter** goes inside (focus on the first button),
  **←**/**→** or **Tab** move between the buttons, **Enter** on "⋮" opens the menu, **Escape** closes the menu,
  the next **Escape** returns to the cell and the arrows move between cells again.

Controls inside your own cell templates (`jtGridCell`) are ordinary Tab stops.

`jt-row-actions` used outside the grid behaves as before: its buttons are ordinary Tab stops.

## Texts

English by default. Pass your own (a function follows the current language):

```ts
providers: [provideJtGridLabels(() => ({ selectAll: t('grid.selectAll'), next: t('grid.next') }))]
```

## Theme

All colors, radii, spacing and durations are `--jt-*` CSS variables with defaults on `:where(:root)`;
any value your app sets wins. See `styles/aria-grid.scss` for the full list.

## Develop

```bash
npm ci
npx ng test aria-grid --watch=false
npx ng build aria-grid        # → dist/aria-grid
cd dist/aria-grid && npm publish
```

License: [MIT](LICENSE) © Jambotron. Made for and deployed on [jambotron.com](https://jambotron.com).
