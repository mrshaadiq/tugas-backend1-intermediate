import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';

const cwd = fileURLToPath(new URL('../', import.meta.url));
let appPort = '3000';
try {
  const env = await readFile(new URL('../.env', import.meta.url), 'utf8');
  appPort = /^APP_PORT\s*=\s*(\d+)\s*$/m.exec(env)?.[1] || appPort;
} catch {}
const baseUrl = process.env.DEMO_URL || `http://127.0.0.1:${appPort}`;
const recreate = process.argv.includes('--recreate');

function compose(args, capture = false) {
  return execFileSync('docker', ['compose', ...args], {
    cwd, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8', timeout: 180000,
  })?.trim();
}
async function request(path, options) {
  const response = await fetch(baseUrl + path, {...options, signal: AbortSignal.timeout(5000)});
  const body = await response.json();
  assert.ok(response.ok, `HTTP ${response.status}: ${JSON.stringify(body)}`);
  return body;
}
async function waitReady() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {await request('/health'); return;}
    catch {await new Promise(resolve => setTimeout(resolve, 1000));}
  }
  throw new Error('Backend belum siap. Cek docker compose logs.');
}
try {
  if (recreate) compose(['version']);
  await waitReady();
  const {data: created} = await request('/tasks', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({title: `Belajar Docker ${new Date().toISOString()}`, description: 'Data bukti demo persistensi.'}),
  });
  console.log('1. Data berhasil ditulis:', JSON.stringify(created, null, 2));
  assert.deepEqual((await request(`/tasks/${created.id}`)).data, created);
  console.log('2. Data berhasil dibaca melalui API.');
  if (recreate) {
    const previous = {};
    for (const service of ['backend', 'db']) {
      previous[service] = compose(['ps', '-q', service], true);
      assert.ok(previous[service], `Service ${service} belum berjalan.`);
    }
    console.log('3. Membuat ulang backend dan db; named volume dipertahankan.');
    compose(['up', '-d', '--force-recreate', '--wait', '--wait-timeout', '90']);
    for (const service of ['backend', 'db']) {
      const current = compose(['ps', '-q', service], true);
      assert.ok(current && current !== previous[service], `Container ${service} tidak berubah.`);
      console.log(`${service}: ${previous[service]} -> ${current}`);
    }
    await waitReady();
    assert.deepEqual((await request(`/tasks/${created.id}`)).data, created);
    console.log('4. LULUS: data dengan ID yang sama masih ada setelah kedua container dibuat ulang.');
  }
  console.log('Daftar tugas:', JSON.stringify(await request('/tasks'), null, 2));
} catch (error) {
  console.error('Demo gagal:', error.message);
  process.exitCode = 1;
}
