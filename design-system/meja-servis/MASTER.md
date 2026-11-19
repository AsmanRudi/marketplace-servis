# Meja Servis — desain publik dan admin

## Sumber dan keputusan

UI UX Pro Max: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
Revisi terpasang: f984fcd3dec8c71cf88f2b47ff8acd0ff4ca99c2.
Pencarian: `home repair services --design-system` dan panduan React untuk navigasi/fokus.
Rekomendasi yang digunakan: Flat Design; alur layanan jelas; transparansi biaya; interaksi ringan; fokus keyboard dan target sentuh yang cukup besar.
Ini adaptasi yang ditinjau, bukan salinan mentah hasil generator. Palet biru/oranye dan font Poppins/Open Sans tidak dipakai karena pengguna meminta konsistensi dengan admin.

## Sistem visual

- Header/sidebar: #203a32. Aksi utama: #31584f dengan teks putih.
- Latar: #f4f6f5. Kartu: putih. Teks: #202d28. Teks sekunder: #596861. Garis: #dde4e0.
- Aksen tambahan atas permintaan pengguna: kuning #f4c95d untuk CTA publik, coral lembut #fce3da untuk variasi kartu. Teks di atas aksen tetap gelap.
- Animasi pembuka 550–650ms sekali saat mount, menu 180ms, hover 200ms. Tidak ada animasi dekoratif berulang; efek baru hanya aktif bila prefers-reduced-motion: no-preference.
- Font lokal Geist; angka tiket Space Mono. Tanpa font/dependency baru.
- Radius tombol/input 8px; kartu 12px. Jarak dasar 8, 16, 24, 32, 48px.
- Layanan servis menjadi fokus; katalog produk tetap pendukung.
- Foto yang tersedia tetap diberi keterangan ilustrasi, bukan foto toko/teknisi asli.

## Perilaku dan responsivitas

- Navbar publik sticky; logo kuning dengan wordmark putih/kuning. Navbar admin HP sticky; menu terbuka dapat discroll pada layar pendek.
- Daftar memakai PagedList: 6 item standar, katalog 8, testimoni 4, toko mitra 3. Nomor halaman, sebelumnya/berikutnya, jumlah hasil, fokus kembali ke daftar. Perubahan filter kembali ke halaman pertama. Form, ringkasan pendek, dan langkah booking tidak dipaginasi.
- Pagination saat ini di sisi klien terhadap hasil API: kasus maksimal 50, produk per toko maksimal 100, antrean admin maksimal 20 per pengambilan. Ringkasan admin menampilkan 6 kasus terbaru dan tautan ke daftar kasus. Ini belum cursor pagination seluruh database.

- Di bawah 1024px, menu publik dan admin menjadi disclosure dengan aria-expanded/aria-controls.
- Escape menutup menu dan mengembalikan fokus. Kontrol tersembunyi tidak dapat ditab.
- CTA dan tautan tindakan minimal 44px tinggi; input HP minimal 16px.
- Kartu layanan satu kolom di bawah 768px; grid memakai minmax(0,1fr).
- Efek hover tidak mengubah ukuran layout; hormati prefers-reduced-motion.
- Testimoni hanya data publik yang disetujui; jangan membuat rating, sertifikasi, atau klaim garansi universal.
- Dashboard tetap di /admin dan terlindungi otorisasi server.

## Instalasi

Skill terpasang global di C:/Users/gigabyte/.codex/skills/ui-ux-pro-max.
Pencarian lokal Python memakai data CSV dan standard library; tidak menjadi bagian runtime web.
Pemeriksaan terbatas pada instruksi, struktur dan pola skrip; bukan jaminan keamanan seluruh repository atau pembaruan berikutnya.
