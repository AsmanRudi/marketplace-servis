import { PagedList } from '../components/PagedList'
import { useEffect, useState } from 'react'
import { api, money, type Shop } from '../api'

import type { Product } from './Products'

type Review = { shop_name:string; city:string; device:string; rating:number; comment:string }
const questions = [
  ['Bagaimana toko menentukan biaya servis?', 'Harga di katalog adalah harga mulai. Setelah perangkat diperiksa, toko mengirim rincian biaya jasa dan suku cadang untuk Anda setujui.'],
  ['Bisa memilih teknisi sendiri?', 'Bisa. Pilih teknisi yang tersedia saat mengajukan servis, atau biarkan toko menugaskan teknisi untuk perangkat Anda.'],
  ['Bagaimana cara melacak servis?', 'Masuk ke akun Anda dan buka Lacak servis. Status terbaru dan penawaran biaya ada di detail tiket.'],
  ['Bagaimana cara klaim garansi?', 'Buka tiket yang telah selesai dan pilih Klaim garansi jika masa garansi toko masih berlaku. Pengelola toko dapat menanggapi dari halaman kasus servis.'],
]

export function Home({ shops }: { shops:Shop[] }) {
  const [slide,setSlide] = useState(0)
  const [paused,setPaused] = useState(false)
  const [reviews,setReviews] = useState<Review[]|null>(null)
  const [reviewError,setReviewError] = useState(false)
  const [featured,setFeatured] = useState<Product[]>([])
  useEffect(() => {
    let active = true
    void api<Review[]>('/orders/reviews').then(items => { if (active) setReviews(items) },
      () => { if (active) setReviewError(true) })
    void api<Product[]>('/products').then(items => { if (active) setFeatured(items.slice(0,3)) },() => {})
    return () => { active=false }
  },[])
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setSlide(current => (current+1)%3),5200)
    return () => window.clearInterval(timer)
  },[paused])
  const districts = [...new Set(shops.filter(shop => shop.city === 'Padang').map(shop => shop.district))].slice(0,6)
  return <div className="landing">
    <section className="hero landing-hero" data-enter>
      <div className="wrap hero-grid grid grid-cols-1 items-center gap-7 md:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] lg:gap-14">
        <div className="hero-copy hero-text">
          <p className="landing-location">Kota Padang, Sumatera Barat</p>
          <h1>Servis HP dan laptop di Padang</h1>
          <p className="landing-intro">HP rusak, aktivitas terhambat? Temukan teknisi tepercaya di Padang, sepakati biaya sebelum perbaikan, lalu pantau progresnya dalam satu tiket.</p>
          <div className="actions"><a className="button" href="?halaman=toko">Cari toko servis <span aria-hidden="true">↗</span></a>
            <a className="text-action" href="?halaman=servis">Lacak servis <span aria-hidden="true">→</span></a></div>
        </div>
        <figure className="hero-photo technician-showcase" aria-label="Teknisi servis HP dan laptop">
          <div className="technician-scenes">
            {[
              { alt:'Teknisi memperbaiki layar ponsel dengan alat presisi',position:'left center' },
              { alt:'Teknisi memeriksa motherboard laptop di meja servis',position:'center center' },
              { alt:'Ponsel dan komponen laptop tersusun di meja teknisi',position:'right center' },
            ].map((scene,index)=><img key={scene.alt} src="/technician-triptych.png" alt={scene.alt} width="2172" height="724" fetchPriority={index===0?'high':undefined} loading={index===0?'eager':'lazy'} className={slide===index?'is-current':''} style={{objectPosition:scene.position}} aria-hidden={slide!==index}/>) }
          </div>
          <span className="repair-orbit repair-orbit-one" aria-hidden="true">+</span>
          <span className="repair-orbit repair-orbit-two" aria-hidden="true">•</span>
          <figcaption><span>MEJA SERVIS · PADANG</span><strong>{['Perbaikan HP','Servis laptop','Ditangani teknisi'][slide]}</strong></figcaption>
          <div className="hero-slide-controls" aria-label="Kontrol gambar teknisi">
            <div className="hero-slide-dots">{['Teknisi HP','Teknisi laptop','Hasil servis'].map((label,index)=><button key={label} type="button" aria-label={label} aria-pressed={slide===index} onClick={()=>setSlide(index)}/>)}</div>
            <button type="button" className="hero-pause" onClick={()=>setPaused(value=>!value)} aria-pressed={paused} aria-label={paused?'Lanjutkan pergantian gambar':'Jeda pergantian gambar'}>{paused?'Lanjutkan':'Jeda'}</button>
          </div>
        </figure>
      </div>
    </section>
    <section className="wrap landing-search" aria-labelledby="landing-search-title">
        <form className="diagnosis-panel" action="/" method="get">
          <input type="hidden" name="halaman" value="toko"/>
          <h2 id="landing-search-title">Cari layanan dari gejala</h2>
          <fieldset className="diagnosis-fields">
            <label>Jenis perangkat<select name="perangkat"><option value="HP">HP / Smartphone</option><option value="Laptop">Laptop</option></select></label>
            <label>Kendala utama<select name="cari"><option value="">Semua layanan</option><option value="diagnosis">Butuh diagnosis</option><option value="baterai">Masalah baterai</option><option value="layar">Masalah layar</option><option value="pembersihan">Pembersihan perangkat</option></select></label>
            <button className="button" type="submit">Cari layanan servis ↗</button>
          </fieldset>
        </form>
    </section>
    <div className="landing-benefits">
      <ul className="wrap grid grid-cols-1 sm:grid-cols-3"><li>Pilihan toko dan teknisi</li><li>Persetujuan biaya sebelum servis</li><li>Riwayat pengerjaan di tiket</li></ul>
    </div>

    <section className="landing-section">
      <div className="wrap"><div className="landing-section-heading"><div><p className="section-eyebrow">LAYANAN PERBAIKAN</p><h2>Perangkat bermasalah?<br/>Mulai dari sini.</h2></div><p>Pilih jenis perangkat, lalu temukan toko dan teknisi yang sesuai dengan kendalanya.</p></div>
        <div className="landing-services grid grid-cols-1 gap-4 sm:grid-cols-3">
          <article><span className="service-index" aria-hidden="true">01 / HP</span><h3>Servis HP</h3><p>Layar pecah, baterai cepat habis, atau port pengisian bermasalah.</p>
            <a className="text-action" href="?halaman=toko&perangkat=HP">Cari servis HP →</a></article>
          <article><span className="service-index" aria-hidden="true">02 / LAPTOP</span><h3>Servis laptop</h3><p>Laptop mati total, kipas berisik, suhu tinggi, atau penyimpanan bermasalah.</p>
            <a className="text-action" href="?halaman=toko&perangkat=Laptop">Cari servis laptop →</a></article>
          <article><span className="service-index" aria-hidden="true">03 / DIAGNOSIS</span><h3>Diagnosis perangkat</h3><p>Jika belum tahu penyebabnya, jelaskan gejala saat mengajukan servis.</p>
            <a className="text-action" href="?halaman=toko&cari=diagnosis">Cari layanan diagnosis →</a></article>
        </div>
      </div>
    </section>
    <section className="landing-section landing-steps">
      <div className="wrap"><h2>Cara memesan servis</h2>
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <li><h3>Pilih toko</h3><p>Lihat layanan dan spesialisasi teknisi. Ajukan permintaan dari katalog.</p></li>
          <li><h3>Setujui penawaran</h3><p>Antarkan perangkat setelah toko mengonfirmasi. Periksa biaya setelah diagnosis.</p></li>
          <li><h3>Ambil perangkat</h3><p>Pantau pembaruan di tiket sampai perangkat siap diambil.</p></li>
        </ol>
      </div>
    </section>
    <section className="landing-section">
      <div className="wrap landing-area grid grid-cols-1 items-center gap-6 md:grid-cols-2 lg:gap-14">
        <img src="/padang-shop-demo.jpg" alt="Ilustrasi bengkel servis di Padang" width="720" height="540" loading="lazy"/>
        <div><h2>Toko servis di Padang</h2>
          <p>Bandingkan layanan dan buka peta lokasi dari daftar toko.</p>
          {districts.length > 0 && <ul className="landing-districts">{districts.map(district =>
            <li key={district}><a href={'?halaman=toko&cari='+encodeURIComponent(district)}>{district} ↗</a></li>)}</ul>}
          <a className="button" href="?halaman=toko">Lihat toko di Padang</a>
        </div>
      </div>
    </section>
    {featured.length > 0 && <section className="landing-section landing-steps">
      <div className="wrap">
        <div className="actions justify-between"><h2>Gadget dan aksesori</h2><a className="text-action" href="?halaman=produk">Buka katalog →</a></div>
        <div className="product-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{featured.map(item => <article className="panel" key={item.id}>
          {item.photo_url && <img className="product-card-photo mb-3.5 block h-40 w-full rounded-sm object-contain" src={item.photo_url} alt={item.name} loading="lazy" referrerPolicy="no-referrer"/>}
          <p className="muted">{item.condition === 'used' ? 'Bekas' : 'Baru'}{item.demo ? ' · Demo' : ''}</p>
          <h3>{item.name}</h3><p><strong>{money(item.price)}</strong></p>
          <a className="text-action" href={'?halaman=detail-produk&id='+item.id}>Lihat produk →</a>
        </article>)}</div>
      </div>
    </section>}
    <section className="landing-section landing-reviews">
      <div className="wrap"><h2>Testimoni pelanggan</h2>
        {reviewError ? <p role="status">Testimoni belum dapat dimuat.</p>
          : reviews === null ? <p role="status">Memuat testimoni…</p>
          : reviews.length === 0 ? <p>Belum ada ulasan publik dari servis yang selesai.</p>
          : <PagedList items={reviews} label="testimoni" size={4} className="landing-quotes grid grid-cols-1 gap-4 sm:grid-cols-2">{(review,index) => <figure key={index}>
            <p className="landing-stars" aria-label={review.rating+' dari 5 bintang'}>{'★'.repeat(review.rating)}</p>
            <blockquote>{review.comment}</blockquote>
            <figcaption>Servis {review.device} · {review.shop_name}, {review.city}</figcaption>
          </figure>}</PagedList>}
      </div>
    </section>
    <section className="landing-section">
      <div className="wrap landing-faq grid grid-cols-1 items-start gap-6 md:grid-cols-2 lg:gap-14"><h2>Pertanyaan umum</h2>
        <div>{questions.map(([question,answer]) => <details key={question}>
          <summary>{question}</summary><p>{answer}</p>
        </details>)}</div>
      </div>
    </section>
    <section className="landing-close">
      <div className="wrap"><h2>Butuh perbaikan perangkat?</h2><a className="button" href="?halaman=toko">Cari toko servis ↗</a></div>
    </section>
  </div>
}

