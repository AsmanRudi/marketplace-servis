# Meja Servis

Marketplace multi-toko untuk servis HP dan laptop. React, Express 5, MongoDB, dan Node.js memakai TypeScript. [PRD](PRD.md) berisi alur produk dan roadmap.

## Susunan proyek

| Lokasi | Isi |
| --- | --- |
| `frontend/src/main.tsx`, `App.tsx` | Titik masuk React, navigasi, dan sesi pengguna. |
| `frontend/src/pages` | Beranda, katalog, booking, login, tiket, dan dashboard mitra. |
| `frontend/src/components` | Komponen bersama seperti formulir dan tampilan kesalahan. |
| `frontend/src/style.css` | Tema Tailwind CSS untuk situs servis dan panel admin, gaya komponen bersama, dan animasi. Utility responsif berada di TSX masing-masing. |
| `frontend/src/pages/Tickets.tsx` | Pelacakan tiket, penawaran, tagihan, dan checkout. |
| `frontend/src/pages/Workspace.tsx` | Dashboard toko, teknisi, dan verifikasi. |
| `frontend/src/api.ts` | Pemanggilan API dan tipe data yang dipakai React. |
| `frontend/public` | Ilustrasi dan animasi Taste Skill. |
| `backend/src/main.ts` | Titik masuk Express dan middleware. |
| `backend/src/db.ts` | Koneksi, bentuk dokumen, dan indeks MongoDB. |
| `backend/src/auth.ts`, `shops.ts`, `orders.ts` | Rute akun, toko, dan servis. |
| `backend/src/products.ts` | Katalog publik serta stok dan publikasi produk per toko. |
| `backend/src/admin.ts` | Ringkasan super admin, antrean verifikasi toko, dan kasus aktif. |
| `backend/src/cases.ts` | Pengajuan komplain, klaim garansi, dan penanganan kasus. |
| `backend/src/ticket-state.ts` | Aturan akses dan perubahan tiket secara atomik. |
| `backend/src/checkout.ts`, `midtrans.ts` | Checkout sandbox dan komunikasi ke Midtrans. |
| `backend/tests` | Uji integrasi servis, pembatasan toko, dan fixture pembayaran. |

## Menjalankan proyek

Siapkan Node.js 22+ dan MongoDB lokal atau Atlas. Salin `backend/.env.example` ke `backend/.env`, lalu isi `MONGODB_URI` dan `MONGODB_DB`. Jalankan perintah dari folder utama proyek.

```powershell
npm ci
npm run db
npm run api
```

Di terminal kedua:

```powershell
npm run dev
```

Buka http://127.0.0.1:5173. Vite meneruskan `/api` ke Express pada port 3001. Jika port backend diubah, sesuaikan target proxy di `frontend/vite.config.mts`.

Isi `ADMIN_EMAIL` dan `ADMIN_PASSWORD` sebelum `npm run db` untuk membuat akun admin platform. Setelah akun terbentuk, hapus variabel bootstrap tersebut. Toko yang didaftarkan dari **Mitra toko** tampil di katalog setelah diverifikasi.

### Data demo dan pemeriksaan

Setel `DEMO_DATA=true` dan `DEMO_PASSWORD` minimal 10 karakter pada database pengujian, lalu jalankan `npm run db`. Untuk menambah tiga toko demo Padang dengan pin perkiraan area, setel `PADANG_DEMO_DATA=true` dan `DEMO_PASSWORD` pada database lokal, lalu jalankan `npm run db`. Foto demo adalah ilustrasi. Pengelola dapat mengatur URL foto HTTPS serta lintang dan bujur di **Mitra toko**. MongoDB menyimpan lokasi sebagai GeoJSON dan katalog memuat peta OpenStreetMap ketika pelanggan memilih **Lihat peta**. Akun staf demo menggunakan `manager1@demo.example` dan `technician1@demo.example`, dengan akhiran 1–3 untuk data demo awal dan 4–6 untuk Padang.

- `npm run check` memeriksa TypeScript pada kedua workspace.
- `npm run build` menghasilkan `frontend/dist` dan `backend/dist`.
- `npm test -w backend` menjalankan uji API dengan database demo. Tetapkan `DEMO_PASSWORD` di lingkungan proses tes dan gunakan `TEST_API_URL` jika port API berbeda.

## MongoDB dan data lama

Dokumen utama berada di koleksi `users`, `sessions`, `shops`, dan `tickets`. Status baca notifikasi disimpan di `notification_reads`. Keanggotaan serta layanan disimpan di dokumen toko. Penawaran, riwayat, pembayaran, dan checkout disimpan di dokumen tiket. Pembaruan bersamaan pada tiket memakai pemeriksaan revisi untuk mencegah penimpaan atau pembayaran ganda.

Data PostgreSQL pengujian telah disalin ke MongoDB lokal. Database terbaru tersedia sebagai `meja_servis` dan snapshot pengujian terdahulu sebagai `meja_servis_arsip_verifikasi`. Keduanya berada dalam instance lokal port 57018, dengan penyimpanan di `.local-mongo/data`. Salinan PostgreSQL dan kode backend lama tetap tersedia sebagai arsip lokal.

Untuk membuka data hasil migrasi dengan binary MongoDB yang sudah tersedia di workspace, jalankan ini dari root proyek pada terminal tersendiri:

```powershell
& ./.local-mongo/mongod.exe --dbpath .local-mongo/data --port 57018 --bind_ip 127.0.0.1
```

Gunakan `MONGODB_URI=mongodb://127.0.0.1:57018` dan `MONGODB_DB=meja_servis` di `backend/.env` untuk memakai data terbaru.

### Mengulang impor pada sumber lain

Jalankan ketika sumber dan target sedang tidak menerima perubahan aplikasi. Atur `PSQL_PATH` bila `psql` belum ada di PATH, lalu tetapkan `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `MONGODB_URI`, dan `MONGODB_DB`. Gunakan metode autentikasi `psql` setempat, seperti `PGPASSFILE`. Jangan menyimpan kredensial di repo.

```powershell
npm run import:postgres -w backend
npm run import:postgres -w backend -- --apply
```

Pemeriksaan awal mendeteksi dokumen berbeda dengan ID yang sama atau email yang sudah dipakai. Impor memvalidasi hasil setiap dokumen dan mendukung pengulangan dengan data yang identik. Sesi kedaluwarsa dilewati. Gunakan database tujuan terpisah untuk arsip sumber dengan ID demo yang sama.

## Dashboard admin

Masuk sebagai super admin di **/admin** untuk melihat toko, status tiket, kasus aktif, dan antrean verifikasi. Navigasi admin menyediakan dashboard, verifikasi toko, ringkasan tiket, kasus servis, dan **Kelola produk** di **/admin/produk**. Menu produk dapat mencari serta memfilter listing lintas toko dan menampilkan atau menyembunyikan produk dari katalog. Angka berasal dari database yang sedang digunakan, termasuk toko demo jika ada.

## Kasus, notifikasi, dan Midtrans sandbox

Pelanggan bisa membuka satu komplain per tiket setelah perangkat diterima atau mengajukan klaim jika garansi masih aktif. Pengelola toko dan admin platform dapat meninjau, membalas, dan menutup kasus dari **Kasus servis**.

Beranda menampilkan testimoni yang diizinkan pelanggan setelah servis selesai. Nama akun tidak dipublikasikan dan pelanggan dapat mengubah visibilitas dari tiket.

Pelanggan membuka **Lacak servis → Buka notifikasi servis** untuk melihat pembaruan terbaru dari toko. Pembaruan dibatasi pada tiket milik pelanggan. Membuka tiket dari notifikasi mencatat status baca.

Isi `MIDTRANS_SANDBOX_SERVER_KEY` pada `backend/.env`, mulai ulang API, dan setel URL notifikasi Midtrans ke `POST /api/orders/midtrans/webhook` pada host sandbox yang dapat dijangkau Midtrans. Arahkan halaman kembali ke `/?halaman=servis`. Pengguna dapat membuka tiket dan memilih **Periksa status checkout** jika webhook terlambat.

Untuk deployment, sajikan frontend dan proxy `/api` dari origin HTTPS yang sama. Aktifkan `COOKIE_SECURE=true` dan pakai koneksi MongoDB terautentikasi. Halaman detail dan keranjang produk tersedia. Keranjang tersimpan di browser dan memeriksa ulang harga serta stok ketika dibuka. Checkout produk dan pengiriman, WhatsApp, refund dari aplikasi, komisi, pencairan, dan pembayaran produksi tetap direncanakan di PRD.

# Pengujian terisolasi (Windows)

Jalankan `npm run test:isolated` untuk build dan pengujian servis dengan MongoDB sementara. Memerlukan `.local-mongo/mongod.exe` dan Chrome pada lokasi standar Windows. Port 57019, 3302, dan 5185 harus kosong; pengujian berhenti jika salah satunya dipakai.

Runner membuat akun dan database sintetis, menjalankan pengujian API yang ada, lalu membuka halaman pelanggan, pengelola, teknisi, dan admin pada lebar 390/768/1440 px. Interaksi pencarian, reset, dan pembukaan detail tiket pelanggan juga diperiksa. Proses serta direktori sementara dibersihkan di akhir. Database aplikasi sehari-hari tidak dipakai.

Pemeriksaan ini bukan audit visual seluruh keadaan formulir dan tidak menjalankan pembayaran Midtrans nyata, WhatsApp, atau pesanan produk.

