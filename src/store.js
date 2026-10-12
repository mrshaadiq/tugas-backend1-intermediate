import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';

export async function initializeDatabase(pool) {
  await pool.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
}

function task(row) {
  return {id: row.id, title: row.title, description: row.description,
    createdAt: new Date(row.created_at).toISOString()};
}

export function createTaskStore(pool) {
  return {
    async health() {await pool.query('SELECT 1');},
    async create({title, description}) {
      const result = await pool.query(
        'INSERT INTO tasks (id, title, description) VALUES ($1, $2, $3) RETURNING *',
        [randomUUID(), title, description]);
      return task(result.rows[0]);
    },
    async list() {
      const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC, id DESC LIMIT 100');
      return result.rows.map(task);
    },
    async get(id) {
      const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
      return result.rows[0] ? task(result.rows[0]) : null;
    },
  };
}
