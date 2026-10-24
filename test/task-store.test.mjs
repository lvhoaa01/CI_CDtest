import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TaskStore, TaskValidationError } from '../src/task-store.mjs';

describe('TaskStore', () => {
  it('creates a normalized task', () => {
    const store = new TaskStore();
    const task = store.create('  Write tests  ');

    assert.equal(task.title, 'Write tests');
    assert.equal(task.completed, false);
    assert.match(task.id, /^[0-9a-f-]{36}$/);
    assert.deepEqual(store.list(), [task]);
  });

  it('returns copies so callers cannot mutate the store', () => {
    const store = new TaskStore();
    const task = store.create('Protected task');
    task.title = 'Changed outside';

    assert.equal(store.list()[0].title, 'Protected task');
  });

  it('updates and deletes an existing task', () => {
    const store = new TaskStore();
    const task = store.create('Ship release');

    assert.equal(store.update(task.id, { completed: true }).completed, true);
    assert.equal(store.delete(task.id), true);
    assert.deepEqual(store.list(), []);
  });

  it('returns null or false for a missing task', () => {
    const store = new TaskStore();

    assert.equal(store.update('missing', { completed: true }), null);
    assert.equal(store.delete('missing'), false);
  });

  it('rejects invalid input', () => {
    const store = new TaskStore();

    assert.throws(() => store.create(' '), TaskValidationError);
    const task = store.create('Valid task');
    assert.throws(() => store.update(task.id, { completed: 'yes' }), TaskValidationError);
  });
});
