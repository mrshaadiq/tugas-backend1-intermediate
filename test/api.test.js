import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newDb, DataType} from 'pg-mem';
import pg from 'pg';
import {createApp} from '../src/app.js';
import {createTaskStore, initializeDatabase} from '../src/store.js';

async function setup(t) {
  const memory = newDb();
  memory.public.registerFunction({name: 'trim', args: [DataType.text], returns: DataType.text, implementation: value => value.trim()});
  memory.public.registerFunction({name: 'length', args: [DataType.text], returns: DataType.integer, implementation: value => value.length});
  const {Pool} = memory.adapters.createPg();
  const pool = process.env.TEST_PGPORT ? new pg.Pool({host: '127.0.0.1', port: Number(process.env.TEST_PGPORT), user: 'demo', database: 'postgres'}) : new Pool();
  await initializeDatabase(pool);
  if (process.env.TEST_PGPORT) {
    await initializeDatabase(pool);
    await pool.query('TRUNCATE TABLE tasks');
  }
  const app = createApp(createTaskStore(pool));
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => app.close(resolve));
    await pool.end();
  });
  const url = `http://127.0.0.1:${app.address().port}`;
  return (path, options) => fetch(url + path, options);
}

const post = body => ({method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});

test('API writes and reads the same task through SQL, including quotes', async t => {
  const request = await setup(t);
  assert.equal((await request('/health')).status, 200);
  assert.deepEqual(await (await request('/tasks')).json(), {data: []});
  const response = await request('/tasks', post({title: "  Belajar Docker'; DROP TABLE tasks; --  ", description: 'Demo database'}));
  assert.equal(response.status, 201);
  const {data: task} = await response.json();
  assert.equal(task.title, "Belajar Docker'; DROP TABLE tasks; --");
  assert.equal(task.description, 'Demo database');
  assert.ok(task.id);
  assert.ok(task.createdAt);
  assert.deepEqual(await (await request(`/tasks/${task.id}`)).json(), {data: task});
  assert.deepEqual(await (await request('/tasks')).json(), {data: [task]});
});

test('rejects invalid bodies without inserting tasks', async t => {
  const request = await setup(t);
  for (const body of [{}, {title: ' '}, {title: 1}, {title: 'a'.repeat(201)}, {title: 'Valid', description: 3}, {title: 'Valid', description: 'a'.repeat(1001)}, null, []]) {
    assert.equal((await request('/tasks', post(body))).status, 400);
  }
  assert.equal((await request('/tasks', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{broken'})).status, 400);
  assert.equal((await request('/tasks', {method: 'POST', body: '{}'})).status, 415);
  assert.equal((await request('/tasks', post({title: 'a'.repeat(20000)}))).status, 413);
  assert.deepEqual(await (await request('/tasks')).json(), {data: []});
});

test('distinguishes missing tasks, invalid IDs and unknown routes', async t => {
  const request = await setup(t);
  assert.equal((await request('/tasks/invalid')).status, 400);
  assert.equal((await request('/tasks/00000000-0000-4000-8000-000000000000')).status, 404);
  assert.equal((await request('/unknown')).status, 404);
  assert.equal((await request('/tasks', {method: 'DELETE'})).status, 405);
});

test('database failure returns 503 without leaking connection information', async t => {
  const store = {
    health: async () => {throw new Error('secret-password');},
    list: async () => {throw new Error('secret-password');},
  };
  const app = createApp(store);
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => app.close(resolve)));
  for (const path of ['/health', '/tasks']) {
    const response = await fetch(`http://127.0.0.1:${app.address().port}${path}`);
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes('secret-password'));
  }
});
