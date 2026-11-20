import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { JT_GRID_BULK_UI, JtGridBulkResult, JtGridBulkService, JtGridBulkUi } from './grid-bulk.service';

describe('JtGridBulkService', () => {
  let answer: string | null;
  let messages: string[];
  let service: JtGridBulkService;

  beforeEach(() => {
    answer = '';
    messages = [];
    const ui: JtGridBulkUi = {
      ask: () => of(answer),
      success: message => messages.push('ok: ' + message),
      error: message => messages.push('error: ' + message)
    };
    TestBed.configureTestingModule({ providers: [{ provide: JT_GRID_BULK_UI, useValue: ui }] });
    service = TestBed.inject(JtGridBulkService);
  });

  const collect = <T>(stream: Observable<JtGridBulkResult<T>>): JtGridBulkResult<T>[] => {
    const results: JtGridBulkResult<T>[] = [];
    stream.subscribe(result => results.push(result));
    return results;
  };

  it('runs every row, keeps going after a failure and reports both', () => {
    const seen: number[] = [];
    const [result] = collect(service.run({
      rows: [1, 2, 3], label: 'Delete', confirm: 'Sure?',
      run: row => { seen.push(row); return row === 2 ? throwError(() => new Error('no')) : of(true); }
    }));

    expect(seen).toEqual([1, 2, 3]);
    expect(result.done).toEqual([1, 3]);
    expect(result.failed).toEqual([2]);
    // One message: a toast that shows one at a time would hide the other
    expect(messages).toEqual(['error: Delete: done 2, failed 1']);
  });

  it('does nothing when cancelled', () => {
    answer = null;
    let ran = false;
    const results = collect(service.run({ rows: [1], label: 'Delete', confirm: 'Sure?', run: () => { ran = true; return of(true); } }));

    expect(ran).toBe(false);
    expect(results).toEqual([]);
  });

  it('passes the one reason to every row', () => {
    answer = 'spam wave';
    const reasons: string[] = [];
    collect(service.run({ rows: [1, 2], label: 'Stop', reason: true, run: (_, reason) => { reasons.push(reason); return of(true); } }));

    expect(reasons).toEqual(['spam wave', 'spam wave']);
  });

  it('shows the progress while rows run and clears it at the end', () => {
    const steps = [new Subject<boolean>(), new Subject<boolean>()];
    collect(service.run({ rows: [0, 1], label: 'Delete', run: row => steps[row] }));

    expect(service.progress()).toEqual({ label: 'Delete', done: 0, total: 2 });
    steps[0].next(true); steps[0].complete();
    expect(service.progress()).toEqual({ label: 'Delete', done: 1, total: 2 });
    steps[1].next(true); steps[1].complete();
    expect(service.progress()).toBeNull();
    expect(messages).toEqual(['ok: Delete: done 2']);
  });
});
