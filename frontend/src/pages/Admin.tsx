import { PagedList } from '../components/PagedList'
import { useEffect, useState } from 'react'
import { api, date, statuses } from '../api'
import { ActionForm } from '../components/ActionForm'

type Overview = {
  shops:{ total:number; verified:number; pending:number }
  tickets:{ total:number; by_status:{ status:string; total:number }[] }
  cases:{ active:number; recent:{ ticket_id:string; shop_name:string; device:string; kind:string; status:string; updated_at:string }[] }
  applications:{ id:string; name:string; city:string; district:string; dropoff_address:string|null; description:string; created_at:string }[]
}
const number = new Intl.NumberFormat('id-ID')

export function Admin() {
  const [overview,setOverview] = useState<Overview|null>(null)
  const [error,setError] = useState(false)
  const [revision,setRevision] = useState(0)
  const [notice,setNotice] = useState('')
  useEffect(() => {
    let active = true
    void api<Overview>('/admin/overview').then(result => { if(active) setOverview(result) },
      () => { if(active) setError(true) })
    return () => { active=false }
  },[revision])
  const ready = overview !== null
  useEffect(() => {
    if (ready && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView()
  },[ready])
  const activeTickets = overview?.tickets.by_status.filter(row => !['completed','cancelled'].includes(row.status))
    .reduce((sum,row) => sum+row.total,0) ?? 0
  const metrics = overview ? [
    { title:'Toko terverifikasi', value:overview.shops.verified, detail:overview.shops.total+' toko terdaftar', link:'#verifikasi-toko' },
    { title:'Menunggu verifikasi', value:overview.shops.pending, detail:'Pengajuan mitra', link:'#verifikasi-toko' },
    { title:'Tiket aktif', value:activeTickets, detail:overview.tickets.total+' tiket tercatat', link:'#ringkasan-tiket' },
    { title:'Kasus aktif', value:overview.cases.active, detail:'Komplain dan klaim garansi', link:'#kasus-aktif' },
  ] : []
  function refresh() { setError(false);setRevision(value => value+1) }
  return <section className="wrap page admin-dashboard">
    <div className="admin-hero">
      <div><h1>Operasional servis</h1><p>Pantau aktivitas servis, verifikasi mitra, dan tindak lanjuti kasus pelanggan.</p>
      </div>
      <button className="admin-refresh" onClick={refresh}>Muat ulang data</button>
    </div>
    {notice && <p className="design-summary" role="status">{notice}</p>}
    {error && <p className="panel error" role="alert">Data dashboard belum dapat dimuat. Gunakan Muat ulang data untuk mencoba lagi.</p>}
    {!overview && !error && <p className="panel" role="status">Memuat data dashboard…</p>}
    {overview && <>
      <section id="ringkasan" aria-labelledby="admin-ringkasan">
        <h2 id="admin-ringkasan" className="admin-heading">Ringkasan operasional</h2>
        <div className="admin-metrics">
          {metrics.map(item => <a href={item.link} className="admin-metric" key={item.title}>
            <span>{item.title}</span><strong>{number.format(item.value)}</strong><small>{item.detail}</small>
          </a>)}
        </div>
      </section>
      <section id="verifikasi-toko" className="admin-card" aria-labelledby="admin-pengajuan">
        <div className="admin-section-head"><h2 id="admin-pengajuan" className="admin-heading">Pengajuan toko</h2>
          <div><span className="design-flag">{overview.shops.pending} menunggu</span> <a className="text-action" href="/admin/toko">Semua toko</a></div></div>
        {!overview.applications.length ? <p className="muted">Tidak ada toko yang menunggu verifikasi.</p>
          : <>
            <p className="muted">Menampilkan hingga 20 pengajuan terlama.</p>
            <PagedList items={overview.applications} label="pengajuan toko" className="admin-verification-grid">{shop => <article className="admin-application admin-verification-card" key={shop.id}>
              <h3>{shop.name}</h3><p>{shop.district}, {shop.city}</p>
              {shop.dropoff_address && <p>{shop.dropoff_address}</p>}
              <p className="muted">{shop.description}</p><p className="muted">Diajukan {date(shop.created_at)}</p>
              <ActionForm label="Verifikasi toko" onSend={async () => {
                await api('/shops/'+shop.id+'/verify',{})
                setNotice(shop.name+' telah diverifikasi.')
                setOverview(current => current ? { ...current,applications:current.applications.filter(item => item.id !== shop.id) } : null)
                refresh()
              }}/>
            </article>}</PagedList>
          </>}
      </section>
      <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section className="admin-card" id="ringkasan-tiket" aria-labelledby="admin-tiket">
          <div className="admin-section-head"><h2 id="admin-tiket" className="admin-heading">Status tiket servis</h2><a className="text-action" href="/admin/tiket">Lihat semua tiket</a></div>
          {!overview.tickets.by_status.length ? <p className="muted">Belum ada tiket tercatat.</p>
            : <ul className="admin-bars">{Object.keys(statuses).flatMap(status => {
              const row = overview.tickets.by_status.find(item => item.status === status)
              return row ? [<li key={status}>
                <div><span>{statuses[status]}</span><strong>{number.format(row.total)}</strong></div>
                <meter min={0} max={overview.tickets.total} value={row.total} aria-label={statuses[status]}/>
              </li>] : []
            })}</ul>}
        </section>
        <section className="admin-card" id="kasus-aktif" aria-labelledby="admin-kasus">
          <div className="admin-section-head"><h2 id="admin-kasus" className="admin-heading">Kasus aktif</h2>
            <a className="text-action" href="/admin/kasus">Lihat semua →</a></div>
          {!overview.cases.recent.length ? <p className="muted">Tidak ada kasus yang perlu ditindaklanjuti.</p>
            : <ul className="admin-case-list">{overview.cases.recent.map(item => <li key={item.ticket_id}>
              <div><strong>{item.kind === 'warranty' ? 'Klaim garansi' : 'Komplain servis'} · {item.device}</strong>
                <p className="muted">{item.shop_name} · {date(item.updated_at)}</p></div>
              <span className="status">{item.status === 'open' ? 'Diajukan' : 'Ditinjau'}</span>
              <a className="text-action" href={'/admin/kasus?tiket='+encodeURIComponent(item.ticket_id)}>Buka kasus →</a>
            </li>)}</ul>}
        </section>
      </div>
    </>}
  </section>
}

