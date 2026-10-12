import pg from 'pg';
import {createApp} from './app.js';
import {createTaskStore, initializeDatabase} from './store.js';

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT tidak valid.');
const pool = new pg.Pool({connectionTimeoutMillis: 5000, query_timeout: 5000, max: 5});
pool.on('error', () => console.error('Koneksi database terputus.'));
try {
  await initializeDatabase(pool);
} catch {
  console.error('Database belum siap. Periksa environment dan service db.');
  await pool.end();
  process.exit(1);
}
const server = createApp(createTaskStore(pool));
server.on('error', async () => {
  console.error('Backend tidak dapat membuka port.');
  await pool.end();
  process.exit(1);
});
server.listen(port, '0.0.0.0', () => console.log(`Backend demo berjalan pada port ${port}.`));
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const timer = setTimeout(() => process.exit(1), 10000);
  timer.unref();
  server.close(async () => {await pool.end(); clearTimeout(timer);});
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
