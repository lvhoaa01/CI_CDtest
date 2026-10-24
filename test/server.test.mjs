import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createApplication } from '../src/server.mjs';
import { TaskStore } from '../src/task-store.mjs';

describe('HTTP application', () => {
  let baseUrl;
  let server;

  before(async () => {
    server = createApplication({
      store: new TaskStore(),
      version: 'test-version',
      commit: 'test-commit',
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('reports health and release identity', async () => {
    const response = await fetch(`${baseUrl}/health`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.status, 'ok');
    assert.equal(payload.version, 'test-version');
    assert.equal(payload.commit, 'test-commit');
  });

  it('serves the web application', async () => {
    const response = await fetch(baseUrl);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /CI\/CD Task Board/);
  });

  it('supports the task lifecycle', async () => {
    const createdResponse = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Deploy safely' }),
    });
    const { task } = await createdResponse.json();
    assert.equal(createdResponse.status, 201);

    const updatedResponse = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    });
    const updatedPayload = await updatedResponse.json();
    assert.equal(updatedPayload.task.completed, true);

    const listResponse = await fetch(`${baseUrl}/api/tasks`);
    const listPayload = await listResponse.json();
    assert.equal(listPayload.tasks.length, 1);

    const deleteResponse = await fetch(`${baseUrl}/api/tasks/${task.id}`, { method: 'DELETE' });
    assert.equal(deleteResponse.status, 204);
  });

  it('rejects invalid task data', async () => {
    const response = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    });

    assert.equal(response.status, 400);
  });
});
