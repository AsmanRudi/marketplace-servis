# PRD Meja Servis

## Produk

Meja Servis adalah marketplace untuk mempertemukan pemilik HP dan laptop dengan toko servis independen. Platform memverifikasi toko dan menyediakan tiket, penawaran biaya, pelacakan, bukti pembayaran, dan riwayat. Toko bertanggung jawab atas diagnosis, pengerjaan, serah terima, dan garansi.

Tujuan awal adalah menyelesaikan transaksi servis dengan biaya yang disetujui pelanggan dan jejak tindakan yang dapat diperiksa. Penjualan perangkat dan aksesori menjadi lini kedua setelah alur servis stabil.

## Pengguna

| Peran | Kebutuhan |
| --- | --- |
| Pelanggan | Cari toko dan layanan sesuai lokasi, pilih teknisi jika diinginkan, ajukan kendala, tinjau biaya, lacak servis, dan lihat bukti pembayaran serta garansi. |
| Pengelola toko | Ajukan verifikasi, kelola katalog layanan dan teknisi, terima perangkat, kelola pekerjaan, dan konfirmasi pembayaran di toko. |
| Teknisi | Lihat tiket yang ditugaskan, catat diagnosis dan estimasi, dan perbarui progres perbaikan. |
| Admin platform | Tinjau dan verifikasi toko. Pada tahap selanjutnya, tangani sengketa dan rekonsiliasi transaksi platform. |

## Alur servis

1. Pelanggan mencari toko terverifikasi, memilih layanan dan preferensi teknisi, lalu mengisi merek, model, dan keluhan.
2. Pengelola mengonfirmasi permintaan, menugaskan teknisi, dan mencatat kondisi perangkat saat diterima.
3. Teknisi mengirim penawaran dengan biaya jasa, suku cadang, dan estimasi waktu. Pelanggan menyetujui versi yang aktif. Revisi biaya memerlukan persetujuan baru.
4. Teknisi memperbarui status sampai perangkat siap diambil.
5. Pengelola mencatat pembayaran langsung di toko berdasarkan total yang terakhir disetujui. Setelah pembayaran tercatat, pengelola menyelesaikan serah terima. Jika total nol, pengelola mencatat bahwa servis bebas biaya.
6. Pelanggan melihat riwayat tiket, bukti pencatatan pembayaran, garansi toko, dan dapat mengirim satu ulasan.

## Cakupan dan kriteria penerimaan

| Tahap | Cakupan dan kriteria |
| --- | --- |
| 1. Marketplace servis | Pelanggan dapat menuntaskan booking hingga serah terima. Hanya toko terverifikasi yang tampil. Toko lain dan teknisi yang belum ditugaskan tidak dapat mengakses tiket. Penawaran kedaluwarsa karena revisi tidak bisa disetujui. |
| 2A. Pencatatan pembayaran | Tagihan menampilkan total versi penawaran terakhir yang disetujui. Hanya pengelola toko pemilik tiket yang boleh mencatat pembayaran pada tiket siap diambil. Nominal harus sama dengan tagihan dan satu tiket memiliki paling banyak satu catatan pembayaran. Pelanggan dapat melihat catatan itu. Tiket yang sudah selesai sebelum fitur ini tetap dapat dibaca. |
| 2B. Pembayaran dan notifikasi terintegrasi | Setelah penyedia dan model bisnis ditetapkan, integrasikan checkout, verifikasi webhook, penanganan event berulang, rekonsiliasi, dan pengembalian dana. Komisi dan pencairan mengikuti model bisnis yang disepakati. Notifikasi WhatsApp resmi dikirim dengan persetujuan penerima dan riwayat pengiriman. |
| 3. Penjualan | Katalog HP dan laptop baru/bekas serta aksesori dan pengelolaan stok per toko sudah tersedia. Detail produk dan keranjang lokal tersedia. Pengiriman dan pembuatan pesanan produk menyusul. Unit bekas memiliki foto aktual, kondisi, kelengkapan, hasil pemeriksaan, dan ketentuan garansi. Identitas unit disimpan secara privat jika diperlukan. |
| 4. Operasional lanjutan | Bukti foto privat, antar-jemput, dan laporan toko serta platform. Pengajuan komplain atau garansi, percakapan kasus, dan penutupan oleh pengelola atau admin telah tersedia. Prioritas mengikuti temuan uji coba. |

## Data dan akses

React dan TypeScript untuk web, Express dan Node.js untuk API, serta MongoDB untuk penyimpanan. Backend memeriksa peran, keanggotaan toko, penugasan teknisi, dan kepemilikan tiket. Penugasan hanya boleh memakai teknisi dari toko pemilik tiket. Perubahan yang menyentuh status, penawaran, atau pembayaran ditulis secara atomik dalam dokumen tiket dengan pemeriksaan revisi. Bukti pembayaran mencatat nominal, metode, penawaran yang menjadi dasar, waktu, dan pengelola pencatat untuk pembayaran di toko. Pembayaran sandbox dikonfirmasi melalui status dari Midtrans. Aplikasi tidak menyimpan data kartu.

## Indikator uji coba

Ukur persentase pengajuan yang diterima toko, waktu dari perangkat diterima sampai penawaran pertama, persentase penawaran disetujui, persentase tiket selesai, serta jumlah keluhan biaya atau serah terima. Tetapkan target setelah memperoleh data awal dari toko pilot.

## Status tahap 2B

Checkout Midtrans Snap sandbox, verifikasi webhook, pengecekan status oleh pelanggan atau pengelola, dan pencatatan pembayaran idempoten tersedia saat dikonfigurasi. Kotak notifikasi pelanggan menampilkan penerimaan permintaan, penawaran, perangkat siap diambil, dan pembatalan oleh toko. Refund dan chargeback yang dilaporkan masuk status perlu diperiksa. Pengembalian dana dari platform, pencairan, dan WhatsApp masih dalam cakupan lanjutan.

## Penyempurnaan operasional servis

Dashboard pelanggan dan meja kerja teknisi menyediakan pencarian nomor tiket/perangkat/toko/layanan, filter status, urutan terbaru atau terlama, jumlah hasil, dan reset. Filter hanya bekerja pada tiket yang dikembalikan API sesuai akses akun; tidak memperluas akses. Urutan memakai waktu pembuatan. Paginasi server diperlukan bila volume tiket mulai besar.

## Keputusan peluncuran

Model pendapatan, penyedia pembayaran, mekanisme refund dan sengketa, area pilot, serta kebijakan WhatsApp perlu disepakati sebelum peluncuran tahap 2B. Pada tahap 2A, pembayaran dilakukan langsung ke toko dan catatannya berfungsi sebagai konfirmasi dari toko.

