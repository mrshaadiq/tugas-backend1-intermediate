# Hasil verifikasi

## 12 Oktober 2026 (tanpa Docker)

- Tes Node.js: 4 lulus dengan pg-mem. Kasus mencakup tulis/baca, input invalid, JSON rusak, body terlalu besar, UUID invalid/tidak ditemukan, method salah, dan database gagal.
- Tes yang sama: 4 lulus dengan PostgreSQL 18 lokal sementara pada loopback port 55439.
- Entrypoint src/server.js dan scripts/demo.mjs diuji melalui HTTP port 3008: tambah, detail, dan daftar tugas berhasil.
- Proses PostgreSQL lokal dihentikan lalu dijalankan ulang menggunakan data directory yang sama. Tugas dengan ID 0ff735b3-cf02-4b59-91b4-6cb49eda982f tetap bisa dibaca, dengan isi dan timestamp identik.
- npm audit --omit=dev: 0 vulnerabilities pada saat pemeriksaan.

## 15 Oktober 2026 (Docker Compose)

Lingkungan: Docker 29.8.2, Docker Compose v5.5.1, Windows 11.

- `docker compose config --quiet`: lolos.
- `docker compose up --build -d --wait`: image `calendar-assignment-demo-backend` berhasil dibangun dari source code. Service `db` (postgres:17-bookworm) dan `backend` keduanya mencapai status healthy.
- `npm run demo:persistence`: lulus.
  - Tugas baru ditulis melalui `POST /tasks`, lalu dibaca melalui API.
  - Kedua container dibuat ulang dengan `--force-recreate`. ID container backend dan db berubah.
  - Data dengan ID yang sama masih terbaca setelah recreate, dan daftar tugas juga menampilkan data dari pengujian sebelumnya. Ini menunjukkan named volume `postgres_data` bertahan.

Catatan: database volume ini sudah berisi data dari pemeriksaan sebelumnya, sehingga daftar tugas memuat lebih dari satu entri. Tes persistensi tidak menghapus volume (tidak memakai `down -v`).
