# Backend Demo APP Calendar untuk Tugas 1

Backend pengganti untuk demo Dockerisasi Backend Study Club Backend Intermediate. Mengambil konsep tugas dari APP Calendar, tetapi merupakan implementasi Node.js dan PostgreSQL khusus tugas ini. Backend ini tidak terhubung ke aplikasi mobile, Firebase, atau Google Calendar.

API menyimpan judul dan deskripsi tugas ke PostgreSQL. Dockerfile membangun image backend dari source code. Docker Compose menjalankan backend dan database sebagai dua service yang terhubung melalui jaringan Compose. Named volume menyimpan data PostgreSQL.

## Prasyarat

- Docker Desktop berjalan dengan Linux containers dan Docker Compose v2 yang mendukung `--wait`.
- Node.js 24 dan npm hanya diperlukan untuk tes dan skrip demo. Menjalankan service melalui Docker tidak memerlukan instalasi Node lokal.
- Jalankan semua perintah berikut dari folder root repository ini.
- Backend demo tidak memakai login. Gunakan data contoh di komputer lokal; port API hanya dipublikasikan pada `127.0.0.1`.

## Menjalankan

```powershell
git clone https://github.com/mrshaadiq/tugas-backend1-intermediate.git
cd tugas-backend1-intermediate
Copy-Item .env.example .env
docker compose config --quiet
docker compose up --build -d --wait
docker compose ps
```

Salin `.env.example` sekali saat setup. API default: `http://localhost:3000`. `APP_PORT` dapat diganti jika port bentrok. `PORT` di dalam container tetap 3000. File `.env` diabaikan oleh Git dan Docker build context. Nilai contoh password dalam `.env.example` hanya untuk database demo lokal.

## Penjelasan Dockerfile dan Compose

- `FROM node:24-bookworm-slim`: lingkungan Node.js backend.
- `COPY package.json package-lock.json` dan `npm ci --omit=dev`: memasang dependency produksi sesuai lockfile.
- `COPY src`: memasukkan source code dan schema SQL ke image.
- `USER node`: menjalankan aplikasi dengan pengguna non-root.
- `EXPOSE 3000`: mendokumentasikan port backend; publikasi port dilakukan oleh Compose.
- `CMD`: menjalankan server. Server membuat tabel jika belum ada, tanpa menghapus data lama.
- Service `backend` dibangun dari Dockerfile; service `db` menggunakan PostgreSQL 17.
- `PGHOST=db`: backend menghubungi database lewat nama service dalam jaringan default Compose. `localhost` di container backend bukan alamat database.
- `depends_on` dengan `service_healthy`: backend menunggu database siap. Healthcheck backend juga melakukan query ke database.
- Database tidak membuka port ke host. Backend menggunakan port internal PostgreSQL 5432.
- Volume `postgres_data` dipasang ke `/var/lib/postgresql/data` untuk image PostgreSQL 17. Penggantian container tidak menghapus named volume tersebut.
- Schema berada di `src/schema.sql`; query memakai parameter untuk memisahkan input dari perintah SQL.

## Endpoint

| Method | Path | Hasil |
|---|---|---|
| GET | `/health` | 200 saat backend dan koneksi database siap |
| POST | `/tasks` | 201 dan tugas yang tersimpan |
| GET | `/tasks` | 200 dan maksimal 100 tugas terbaru |
| GET | `/tasks/:id` | 200 untuk UUID yang ditemukan |

Body POST menggunakan `Content-Type: application/json`. `title` wajib string 1-200 karakter setelah trim; `description` opsional string maksimal 1000 karakter. Body maksimal 16 KiB. Input salah menghasilkan 400, media type salah 415, body terlalu besar 413, dan database gagal 503. UUID tidak valid menghasilkan 400, UUID yang tidak ditemukan 404.

```powershell
Invoke-RestMethod http://localhost:3000/health
$body = @{ title = 'Belajar Docker'; description = 'Tugas Backend Intermediate' } | ConvertTo-Json
$created = Invoke-RestMethod http://localhost:3000/tasks -Method Post -ContentType 'application/json' -Body $body
$created | ConvertTo-Json -Depth 5
Invoke-RestMethod http://localhost:3000/tasks | ConvertTo-Json -Depth 5
Invoke-RestMethod "http://localhost:3000/tasks/$($created.data.id)" | ConvertTo-Json -Depth 5
```

## Membuktikan persistensi

Lanjutkan dari terminal yang sama agar `$created` masih tersedia:

```powershell
docker compose ps -q
docker compose up -d --force-recreate --wait
docker compose ps -q
Invoke-RestMethod "http://localhost:3000/tasks/$($created.data.id)" | ConvertTo-Json -Depth 5
```

Tunjukkan bahwa ID container berubah, tetapi ID dan isi tugas yang dibaca lewat API tetap sama. Jangan menggunakan `docker compose down -v` dalam pengujian; opsi `-v` menghapus volume dan data.

Alternatif demo otomatis:

```powershell
npm ci
npm run demo
npm run demo:persistence
```

Skrip persistensi membuat tugas baru, membaca data, mencatat ID kedua container, membuat ulang kedua service, memastikan kedua ID container berubah, kemudian membandingkan data dengan ID yang sama. Hasil gagal memberikan exit code bukan nol. Skrip harus dijalankan saat service Compose sudah aktif. Jika port API berbeda, skrip membaca `APP_PORT` dari `.env`, atau gunakan `$env:DEMO_URL='http://127.0.0.1:PORT'`.

## Pengujian dan troubleshooting

```powershell
npm ci
npm test
npm audit --omit=dev
docker compose logs backend db
```

Tes default menggunakan emulator SQL `pg-mem` untuk memeriksa API dan query, bukan bukti persistensi Docker. Demo persistensi di atas menguji PostgreSQL container nyata. Jika password `.env` diganti setelah volume terisi, akun database lama tetap memakai password sebelumnya; gunakan kembali kredensial awal untuk volume itu. `docker compose down` menghentikan service dan mempertahankan named volume.

## Referensi dan bantuan

- Konsep fitur: APP Calendar milik proyek ini. Implementasi demo dibuat khusus untuk tugas.
- Bantuan AI: OpenAI Codex digunakan untuk menyusun source code, konfigurasi Docker/Compose, tes, dan README. Pelaksana tugas harus memahami dan menjelaskan implementasinya sendiri.
- [Node.js HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html).
- [node-postgres parameterized queries](https://node-postgres.com/features/queries).
- [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/).
- [Docker Compose networking](https://docs.docker.com/compose/how-tos/networking/).
- [Docker Compose volumes](https://docs.docker.com/reference/compose-file/volumes/).
