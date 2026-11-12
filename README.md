# Backend Demo APP Calendar untuk Tugas 1

Backend pengganti untuk demo Dockerisasi Backend Study Club Backend Intermediate. Mengambil konsep tugas dari APP Calendar, tetapi merupakan implementasi Node.js dan PostgreSQL khusus tugas ini. Backend ini tidak terhubung ke aplikasi mobile, Firebase, atau Google Calendar.

API menyimpan judul dan deskripsi tugas ke PostgreSQL. Dockerfile membangun image backend dari source code. Docker Compose menjalankan backend dan database sebagai dua service yang terhubung melalui jaringan Compose. Named volume menyimpan data PostgreSQL.

## Prasyarat

- Docker Desktop berjalan dengan Linux containers dan Docker Compose v2 yang mendukung `--wait`.
- Node.js 24 dan npm hanya diperlukan untuk tes dan skrip demo. Menjalankan service melalui Docker tidak memerlukan instalasi Node lokal.
- Jalankan semua perintah berikut dari folder root repository ini.
- Backend demo tidak memakai login. Gunakan data contoh di komputer lokal; port nginx hanya dipublikasikan pada `127.0.0.1`.

## Menjalankan

```powershell
git clone https://github.com/mrshaadiq/tugas-backend1-intermediate.git
cd tugas-backend1-intermediate
Copy-Item .env.example .env
docker compose config --quiet
docker compose up --build -d --wait
docker compose ps
```

Salin `.env.example` sekali saat setup. Pintu masuk default: `http://localhost:8080` (nginx). `APP_PORT` mengatur port nginx di host dan dapat diganti jika bentrok. `PORT` di dalam container backend tetap 3000. File `.env` diabaikan oleh Git dan Docker build context. Nilai contoh password dalam `.env.example` hanya untuk database demo lokal.

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
- Database dan backend tidak membuka port ke host (hanya nginx). Backend menggunakan port internal PostgreSQL 5432.
- Volume `postgres_data` dipasang ke `/var/lib/postgresql/data` untuk image PostgreSQL 17. Penggantian container tidak menghapus named volume tersebut.
- Schema berada di `src/schema.sql`; query memakai parameter untuk memisahkan input dari perintah SQL.

## Endpoint

Semua request dari host harus lewat nginx dengan prefix `/api/` (contoh `/api/tasks`); nginx menghapus prefix tersebut sebelum meneruskan ke backend. Contoh PowerShell di bawah memakai path tanpa prefix menurut route backend; tambahkan `/api` di depannya saat memanggil lewat nginx.

| Method | Path | Hasil |
|---|---|---|
| GET | `/health` (lewat nginx: `/api/health`) | 200 saat backend dan koneksi database siap |
| POST | `/tasks` | 201 dan tugas yang tersimpan |
| GET | `/tasks` | 200 dan maksimal 100 tugas terbaru |
| GET | `/tasks/:id` | 200 untuk UUID yang ditemukan |

Body POST menggunakan `Content-Type: application/json`. `title` wajib string 1-200 karakter setelah trim; `description` opsional string maksimal 1000 karakter. Body maksimal 16 KiB. Input salah menghasilkan 400, media type salah 415, body terlalu besar 413, dan database gagal 503. UUID tidak valid menghasilkan 400, UUID yang tidak ditemukan 404.

```powershell
Invoke-RestMethod http://localhost:8080/health
$body = @{ title = 'Belajar Docker'; description = 'Tugas Backend Intermediate' } | ConvertTo-Json
$created = Invoke-RestMethod http://localhost:8080/tasks -Method Post -ContentType 'application/json' -Body $body
$created | ConvertTo-Json -Depth 5
Invoke-RestMethod http://localhost:8080/tasks | ConvertTo-Json -Depth 5
Invoke-RestMethod "http://localhost:8080/tasks/$($created.data.id)" | ConvertTo-Json -Depth 5
```

## Tugas 2: nginx, load balancing, rate limit

Arsitektur: `client -> nginx:8080 -> backend (3 replica, port 3000 internal) -> db`. Hanya service `nginx` yang punya `ports`; `backend` hanya memakai `expose` dan `db` tidak membuka port apa pun. Konfigurasi ada di [nginx/default.conf](nginx/default.conf), replica diatur lewat `deploy.replicas: 3` di [compose.yaml](compose.yaml).

| Kebutuhan | Implementasi |
|---|---|
| Satu pintu | service `nginx` satu-satunya dengan `ports` |
| Reverse proxy | `location /api/` -> `proxy_pass http://app_backend/` + `proxy_set_header Host` dan `X-Forwarded-For` |
| Load balancing | `upstream app_backend` dengan `zone`, 3 replica, header `X-Upstream: $upstream_addr` |
| Rate limit | `limit_req_zone` 5 r/s, `limit_req burst=5 nodelay` di `/api/`, `limit_req_status 429` |
| Header & gzip | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`; `gzip on` untuk `application/json` |

Jalankan: `docker compose up --build -d --wait` lalu `docker compose ps` (3 baris backend, 1 nginx, 1 db).

### Bukti (output curl)

Load balancing: `X-Upstream` berganti antar tiga IP replica.

```text
$ for i in 1 2 3 4 5 6; do curl -s -o /dev/null -D - http://localhost:8080/api/health | grep -iE '^(HTTP|x-upstream)'; done
HTTP/1.1 200 OK X-Upstream: 172.18.0.5:3000
HTTP/1.1 200 OK X-Upstream: 172.18.0.4:3000
HTTP/1.1 200 OK X-Upstream: 172.18.0.3:3000
HTTP/1.1 200 OK X-Upstream: 172.18.0.5:3000
HTTP/1.1 200 OK X-Upstream: 172.18.0.4:3000
HTTP/1.1 200 OK X-Upstream: 172.18.0.3:3000
```

Rate limit: 30 request paralel, sebagian ditolak 429.

```text
$ seq 1 30 | xargs -P 30 -I{} curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/api/health | sort | uniq -c
     14 200
     16 429

$ (header salah satu respons 429)
HTTP/1.1 429 Too Many Requests
Server: nginx/1.27.5
Content-Type: text/html
Content-Length: 169
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
```

Header keamanan dan gzip:

```text
$ curl -s -D - -o /dev/null -H 'Accept-Encoding: gzip' http://localhost:8080/api/tasks
HTTP/1.1 200 OK
Server: nginx/1.27.5
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
Cache-Control: no-store
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
X-Upstream: 172.18.0.5:3000
Content-Encoding: gzip

$ curl -s -H 'Accept-Encoding: gzip' -o /dev/null -w 'gzip: %{size_download} bytes\n' http://localhost:8080/api/tasks
gzip: 358 bytes
$ curl -s -o /dev/null -w 'plain: %{size_download} bytes\n' http://localhost:8080/api/tasks
plain: 689 bytes
```

Port backend lama tidak bisa diakses:

```text
$ curl -sS -m 5 http://localhost:3000/health
curl: (7) Failed to connect to localhost port 3000 after 2244 ms: Could not connect to server

$ docker compose port backend 3000
invalid IP:0
```

### Jawaban pertanyaan

**(a) Kenapa upstream perlu `zone`? Apa yang terjadi kalau dihapus?** Nginx menjalankan beberapa worker process, dan tanpa `zone` setiap worker menyimpan state upstream sendiri-sendiri (urutan round-robin, status server, hitungan koneksi). Dengan `zone` state itu ada di shared memory sehingga semua worker memakai pembagian yang sama dan konsisten. Kalau dihapus, nginx tetap jalan tetapi distribusi antar replica bisa tidak merata dan state tidak dibagi antar worker; beberapa fitur yang butuh shared memory juga tidak tersedia.

**(b) Kenapa `limit_req_status` diganti ke 429? Apa bedanya dengan bawaan?** Bawaan nginx menolak dengan 503 Service Unavailable, yang terbaca seolah server rusak atau down. 429 Too Many Requests adalah kode standar yang menyatakan klien terlalu sering mengirim request, sehingga klien, monitoring, dan retry logic bisa membedakan pembatasan dari error server yang sebenarnya.

**(c) Kenapa backend dan database tidak punya `ports`, dan nginx menjangkau backend lewat apa?** Tanpa `ports`, tidak ada celah dari host atau jaringan luar langsung ke backend dan database, jadi rate limit, header keamanan, dan gzip di nginx tidak bisa dilewati. Nginx menjangkau backend lewat jaringan default Compose: nama service `backend` di-resolve oleh DNS internal Docker menjadi IP ketiga replica, lalu nginx terhubung ke port internal 3000 (`expose`) pada IP tersebut.

## Membuktikan persistensi

Lanjutkan dari terminal yang sama agar `$created` masih tersedia:

```powershell
docker compose ps -q
docker compose up -d --force-recreate --wait
docker compose ps -q
Invoke-RestMethod "http://localhost:8080/tasks/$($created.data.id)" | ConvertTo-Json -Depth 5
```

Tunjukkan bahwa ID container berubah, tetapi ID dan isi tugas yang dibaca lewat API tetap sama. Jangan menggunakan `docker compose down -v` dalam pengujian; opsi `-v` menghapus volume dan data.

Alternatif demo otomatis:

```powershell
npm ci
npm run demo
npm run demo:persistence
```

Skrip persistensi membuat tugas baru, membaca data, mencatat ID kedua container, membuat ulang kedua service, memastikan kedua ID container berubah, kemudian membandingkan data dengan ID yang sama. Hasil gagal memberikan exit code bukan nol. Skrip harus dijalankan saat service Compose sudah aktif. Jika port API berbeda, skrip membaca `APP_PORT` dari `.env`, atau gunakan `$env:DEMO_URL='http://127.0.0.1:PORT/api'`.

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
