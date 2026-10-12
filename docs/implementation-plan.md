# Backend demo tugas Docker

Tujuan: backend tugas sederhana yang dibangun dari source dan terhubung ke PostgreSQL melalui Docker Compose. Semua pekerjaan berada di folder tugas ini.

Desain sesuai percakapan: Node.js 24, HTTP API JSON, driver pg, service backend dan db, named volume PostgreSQL. API GET /health, POST /tasks, GET /tasks, GET /tasks/:id. Tidak memakai Firebase atau Google Calendar. Demo lokal memakai data contoh tanpa autentikasi.

## Langkah implementasi

- [x] Tulis tes HTTP dan SQL untuk tambah/baca tugas, validasi, judul dengan tanda kutip, JSON rusak, ID tidak valid, dan database tidak tersedia. Jalankan sebelum implementasi.
- [x] Buat app, repository PostgreSQL, schema idempotent, dan server dengan graceful shutdown. Jalankan kembali tes.
- [x] Tambahkan Dockerfile non-root, lockfile, Compose dengan healthcheck database, port loopback, dan volume pada path PostgreSQL 17.
- [x] Tambahkan environment contoh, README Indonesia, skrip demo tulis/baca dan recreate container dengan volume tetap ada.
- [x] Verifikasi tes, dependency audit, dan konfigurasi; coba build/demo Docker jika tersedia. Catat keterbatasan tanpa mengklaim persistensi nyata jika Docker belum bisa dijalankan.

## Review

SQL harus memakai parameter. Body dibatasi 16 KiB. Input title harus string 1-200 karakter setelah trim, description string maksimal 1000 karakter. Healthcheck memeriksa koneksi database. ID UUID tidak valid menghasilkan 400; UUID valid yang tidak ditemukan menghasilkan 404. Respons database gagal tidak membocorkan detail koneksi.

Tes SQL lokal menggunakan pg-mem, bukan bukti PostgreSQL container. Bukti Docker yang diperlukan: build, dua service healthy, POST dan GET, ID container berubah setelah recreate, GET dengan ID yang sama tetap berhasil. Skrip tidak menjalankan down -v.
