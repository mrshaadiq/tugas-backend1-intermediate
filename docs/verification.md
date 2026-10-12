# Hasil verifikasi 12 Oktober 2026

- Tes Node.js: 4 lulus dengan pg-mem. Kasus mencakup tulis/baca, input invalid, JSON rusak, body terlalu besar, UUID invalid/tidak ditemukan, method salah, dan database gagal.
- Tes yang sama: 4 lulus dengan PostgreSQL 18 lokal sementara pada loopback port 55439.
- Entrypoint src/server.js dan scripts/demo.mjs diuji melalui HTTP port 3008: tambah, detail, dan daftar tugas berhasil.
- Proses PostgreSQL lokal dihentikan lalu dijalankan ulang menggunakan data directory yang sama. Tugas dengan ID 0ff735b3-cf02-4b59-91b4-6cb49eda982f tetap bisa dibaca, dengan isi dan timestamp identik.
- npm audit --omit=dev: 0 vulnerabilities pada saat pemeriksaan.
- Review kode dan konfigurasi tidak menemukan masalah penting yang menghalangi demo.
- Docker tidak tersedia. Build image, docker compose config, healthcheck container, dan persistensi named volume setelah recreate container belum dijalankan. PostgreSQL lokal versi 18 bukan pengganti verifikasi image PostgreSQL 17 dalam Compose.

Langkah verifikasi container saat Docker tersedia: salin .env.example menjadi .env; jalankan docker compose config --quiet, docker compose up --build -d --wait, kemudian npm run demo:persistence. Skrip memeriksa perubahan ID kedua container dan data yang identik lewat API. Tes lokal menggunakan data contoh, tanpa kredensial cloud APP Calendar. Database dan backend verifikasi sementara dihentikan setelah pengujian.
