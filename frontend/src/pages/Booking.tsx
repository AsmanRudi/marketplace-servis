import { PagedList } from '../components/PagedList'
import { useState } from 'react'
import { api, money, type Account, type Shop } from '../api'
import { ActionForm, field } from '../components/ActionForm'

export function Directory({ shops, state, reload, select }: { shops: Shop[]; state: string; reload: () => void; select: (shop: Shop) => void }) {
  const [find,setFind] = useState(() => new URLSearchParams(location.search).get('cari') ?? '')
  const [device,setDevice] = useState(() => {
    const value = new URLSearchParams(location.search).get('perangkat')
    return value === 'HP' || value === 'Laptop' ? value : ''
  })
  const [selectedCity,setCity] = useState<string|null>(null)
  const city = selectedCity ?? (shops.some(shop => shop.city === 'Padang') ? 'Padang' : '')
  const [mapShop,setMapShop] = useState('')
  const cities = [...new Set(shops.map(shop => shop.city))].sort()
  const result = shops.filter(shop => {
    const listing = shop.services.filter(service => !device || service.device === device)
    return (!city || shop.city === city) && (!device || listing.length) &&
      (shop.name + ' ' + shop.city + ' ' + shop.district + ' ' + listing.map(service => service.name).join(' ')).toLowerCase().includes(find.trim().toLowerCase())
  })
  return <section className="wrap page"><h1>Cari toko servis</h1>
    <div className="filters directory-filters grid-cols-1 md:grid-cols-[2fr_1fr_1fr]"><label>Cari lokasi atau layanan<input value={find} onChange={e => setFind(e.target.value)} placeholder="Contoh: Kuranji atau ganti baterai"/></label>
      <label>Kota<select value={city} onChange={e => setCity(e.target.value)}><option value="">Semua kota</option>{cities.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Jenis perangkat<select value={device} onChange={e => setDevice(e.target.value)}><option value="">Semua perangkat</option><option>HP</option><option>Laptop</option></select></label></div>
    {state === 'error' ? <div className="panel"><p role="alert">Daftar toko belum dapat dimuat.</p><button className="button" onClick={reload}>Muat ulang</button></div>
      : state === 'loading' ? <p role="status">Memuat toko…</p>
      : result.length === 0 ? <p role="status">Belum ada toko yang sesuai dengan pencarian Anda.</p>
      : <PagedList items={result} label="toko servis" resetKey={JSON.stringify([find,city,device])} className="shop-list">{shop => <article className="shop-row grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_1fr] md:gap-8" key={shop.id}>
        <div className="shop-identity grid grid-cols-1 items-start gap-4 sm:grid-cols-[minmax(115px,.65fr)_1fr]">
          <ShopPhoto shop={shop}/>
          <div><p className="muted">{shop.district}, {shop.city}{shop.demo ? ' · Toko demo' : ''}</p><h2>{shop.name}</h2><p>{shop.description}</p>
            <p className="muted">{shop.technicians.length ? 'Teknisi: ' + shop.technicians.map(tech => tech.name + (tech.specialty ? ' · ' + tech.specialty : '')).join(', ') : 'Teknisi belum terdaftar'}</p>
            {shop.rating !== null && <p className="muted">Penilaian {shop.rating}/5</p>}
          </div>
        </div>
        <div><ul>{shop.services.filter(s => !device || s.device === device).map(s => <li key={s.id}>{s.name} <span>mulai {money(s.starting_price)}{s.warranty_days > 0 ? " · Garansi " + s.warranty_days + " hari" : ""}</span></li>)}</ul>
          <div className="actions">
            {shop.services.length > 0 && <button className="button" onClick={() => select(shop)}>Pilih layanan <span aria-hidden="true">↗</span></button>}
            {shop.location && <button className="link" aria-expanded={mapShop === shop.id} onClick={() => setMapShop(mapShop === shop.id ? '' : shop.id)}>
              {mapShop === shop.id ? 'Tutup peta' : 'Lihat peta'}
            </button>}
          </div>
        </div>
        {shop.location && mapShop === shop.id && <ShopMap shop={shop} coordinates={shop.location.coordinates}/>}
      </article>}</PagedList>}
    {city === 'Padang' && <aside className="panel"><h2>Referensi servis resmi di Padang</h2>
      <p className="muted">Cek alamat dan jadwal langsung di situs penyedia.</p>
      <div className="actions"><a className="text-action" href="https://support.oppo.com/id/premium/terms-conditions/" target="_blank" rel="noopener noreferrer">Lihat referensi OPPO ↗</a>
        <a className="text-action" href="https://www.asus.com/id/support/service-center/indonesia/" target="_blank" rel="noopener noreferrer">Cari pusat servis ASUS ↗</a></div>
    </aside>}
  </section>
}
function ShopPhoto({ shop }: { shop:Shop }) {
  const source = shop.photo_url ?? (shop.demo && shop.city === 'Padang' ? '/padang-shop-demo.jpg' : null)
  const [failed,setFailed] = useState<string|null>(null)
  return source && source !== failed
    ? <img className="shop-photo" src={source} alt={shop.photo_url ? 'Foto ' + shop.name : 'Ilustrasi toko servis di Padang'}
        loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(source)}/>
    : <div className="shop-photo shop-photo-empty">Foto belum tersedia</div>
}
function ShopMap({ shop, coordinates }: { shop:Shop; coordinates:[number,number] }) {
  const [lon,lat] = coordinates
  const bbox = [Math.max(-180,lon-.008),Math.max(-90,lat-.006),Math.min(180,lon+.008),Math.min(90,lat+.006)]
  const params = new URLSearchParams({ bbox:bbox.join(','),layer:'mapnik',marker:lat+','+lon })
  return <div className="shop-map">
    {shop.demo && <p className="muted">Pin demo menunjukkan perkiraan area kecamatan.</p>}
    <iframe title={'Peta lokasi '+shop.name} src={'https://www.openstreetmap.org/export/embed.html?'+params} loading="lazy"/>
    <a className="text-action" href={'https://www.openstreetmap.org/?mlat='+lat+'&mlon='+lon+'#map=16/'+lat+'/'+lon}
      target="_blank" rel="noopener noreferrer">Buka OpenStreetMap ↗</a>
  </div>
}
const bookingSteps = ['Identifikasi perangkat','Pilih teknisi','Konfirmasi tiket']
const symptoms = ['Layar bermasalah','Baterai cepat habis','Mati total','Panas berlebih','Port pengisian bermasalah','Kena cairan']
export function Booking({ shop, account, signIn, onCreated }: { shop: Shop; account: Account | null | undefined; signIn: () => void; onCreated: (id: string) => void }) {
  const [step,setStep] = useState(0)
  const [diagnosis,setDiagnosis] = useState({ service_id:shop.services[0]?.id ?? '',device_model:'',complaint:'',symptoms:[] as string[] })
  const [technician,setTechnician] = useState('')
  const service = shop.services.find(item => item.id === diagnosis.service_id)
  const tech = shop.technicians.find(item => item.id === technician)
  function advance(next: number) {
    setStep(next)
    document.getElementById('booking-step-heading')?.focus()
  }
  return <section className="wrap page max-w-[920px]">
    <a className="back" href="?halaman=toko">← Daftar toko</a>
    <h1>Booking dan diagnosis</h1>
    <p className="muted">{shop.name} · {shop.district}, {shop.city}</p>
    <ol className="booking-steps">{bookingSteps.map((label,index) =>
      <li key={label} aria-current={index === step ? 'step' : undefined}>{index+1}. {label}</li>)}</ol>
    <h2 id="booking-step-heading" tabIndex={-1}>{bookingSteps[step]}</h2>
    {!account ? <div className="panel"><p>Masuk untuk menyimpan permintaan servis dan melacak tiket.</p><button className="button" onClick={signIn}>Masuk untuk memesan</button></div>
      : step === 0 ? <ActionForm key="diagnosis" className="panel" label="Pilih teknisi" onSend={async form => {
        setDiagnosis({
          service_id:field(form,'service_id'),device_model:field(form,'device_model'),complaint:field(form,'complaint'),
          symptoms:form.getAll('symptom').map(String),
        })
        advance(1)
      }}>
        <label>Layanan<select name="service_id" required defaultValue={diagnosis.service_id}>{shop.services.map(item => <option key={item.id} value={item.id}>{item.device} · {item.name} · mulai {money(item.starting_price)}</option>)}</select></label>
        <label>Merek dan model perangkat<input name="device_model" required minLength={2} maxLength={120} defaultValue={diagnosis.device_model} placeholder="Contoh: Samsung Galaxy A54"/></label>
        <div role="group" aria-label="Gejala perangkat">
          <p className="font-semibold">Gejala yang terlihat</p><div className="booking-options">{symptoms.map(symptom =>
            <label key={symptom}><input type="checkbox" name="symptom" value={symptom} defaultChecked={diagnosis.symptoms.includes(symptom)}/>{symptom}</label>)}</div>
        </div>
        <label>Ceritakan kendala<textarea name="complaint" rows={4} required minLength={5} maxLength={1200} defaultValue={diagnosis.complaint} placeholder="Contoh: layar bergaris setelah perangkat terjatuh"/></label>
      </ActionForm>
      : step === 1 ? <ActionForm key="technician" className="panel" label="Tinjau tiket" onSend={async form => {
        setTechnician(field(form,'preferred_id'))
        advance(2)
      }}>
        <div className="design-summary"><p>{diagnosis.device_model} · {service?.name}</p>
          {service && <p>Harga mulai {money(service.starting_price)}. Biaya akhir menunggu pemeriksaan unit.</p>}</div>
        <div className="booking-options" role="group" aria-label="Pilihan teknisi">
          <label><input type="radio" name="preferred_id" value="" defaultChecked={!technician}/>Toko memilih teknisi</label>
          {shop.technicians.map(item => <label key={item.id}><input type="radio" name="preferred_id" value={item.id} defaultChecked={technician === item.id}/><span><strong>{item.name}</strong>{item.specialty && <><br/>{item.specialty}</>}</span></label>)}
        </div>
        <p className="muted">Metode serah terima: antar perangkat ke toko setelah permintaan dikonfirmasi.</p>
      </ActionForm>
      : <ActionForm key="confirm" className="panel" label="Kirim permintaan" onSend={async () => {
        const complaint = diagnosis.symptoms.length
          ? diagnosis.complaint + '\n\nGejala: ' + diagnosis.symptoms.join(', ')
          : diagnosis.complaint
        const order = await api<{ id:string }>('/orders',{
          service_id:diagnosis.service_id,preferred_id:technician || null,device_model:diagnosis.device_model,complaint,
        })
        onCreated(order.id)
      }}>
        <div className="design-summary"><p><strong>{diagnosis.device_model}</strong></p>
          <p>{service?.name} · {tech?.name ?? 'Teknisi ditentukan toko'}</p>
          <p>{diagnosis.complaint}</p>
          {diagnosis.symptoms.length > 0 && <p className="muted">{diagnosis.symptoms.join(' · ')}</p>}
        </div>
        <p className="muted">Setelah tiket dibuat, pantau konfirmasi dan penawaran biaya di Lacak servis.</p>
      </ActionForm>}
    {account && step > 0 && <button className="link" onClick={() => advance(step-1)}>← Kembali ke tahap sebelumnya</button>}
  </section>
}

