import { useEffect, useMemo, useState } from 'react'
import { api, date, statuses } from '../api'
import { PagedList } from '../components/PagedList'

type TicketRow = { id:string; shop_name:string; service_name:string; device:string; device_model:string; status:string; created_at:string; completed_at:string|null; customer:{ name:string; email:string }|null; technician_name:string|null; payment_status:string }

export function AdminTickets() {
  const [rows,setRows] = useState<TicketRow[]|null>(null)
  const [error,setError] = useState('')
  const [query,setQuery] = useState('')
  const [filter,setFilter] = useState('all')
  const [retry,setRetry] = useState(0)
  useEffect(() => {
    let active=true
    void api<TicketRow[]>('/admin/tickets').then(value=>{ if(active) setRows(value) },failure=>{ if(active) setError(failure instanceof Error?failure.message:'Daftar tiket belum dapat dimuat.') })
    return ()=>{ active=false }
  },[retry])
  const filtered=useMemo(()=>rows?.filter(row=>(filter==='all'||row.status===filter)&&`${row.id} ${row.shop_name} ${row.service_name} ${row.device_model} ${row.customer?.name??''} ${row.customer?.email??''}`.toLocaleLowerCase('id').includes(query.trim().toLocaleLowerCase('id'))),[rows,filter,query])
  return <section className="wrap page admin-management">
    <div className="admin-hero"><div><p className="admin-kicker">OPERASIONAL · PEMANTAUAN</p><h1>Tiket servis</h1><p>Daftar tiket dari pemesanan pelanggan, beserta status dan pembayaran.</p></div><strong className="admin-manage-total">{rows?.length??'—'} tiket</strong></div>
    {error&&<div className="panel"><p className="error" role="alert">{error}</p><button className="button" onClick={()=>{setError('');setRetry(x=>x+1)}}>Muat ulang</button></div>}
    <section className="admin-card admin-manage-list admin-ticket-list"><div className="admin-section-head"><div><p className="admin-kicker">DATA SERVIS</p><h2 className="admin-heading">Semua tiket</h2></div><label className="admin-product-filter">Status<select value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">Semua status</option>{Object.entries(statuses).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label></div>
      <label className="admin-product-search">Cari tiket, pelanggan, atau toko<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="ID tiket, nama pelanggan, toko…"/></label>
      {!rows&&!error&&<p role="status">Memuat tiket…</p>}
      {filtered?.length===0&&<p className="admin-empty">Belum ada tiket yang cocok.</p>}
      {filtered&&<PagedList items={filtered} label="tiket servis" resetKey={query+filter} size={10} className="admin-manage-grid admin-ticket-grid">{row=><article className="admin-manage-row admin-ticket-row" key={row.id}><div className="admin-manage-main"><div className="admin-manage-top"><span className="design-flag">{statuses[row.status]??row.status}</span><span className="admin-product-state">{row.payment_status==='paid'?'Dibayar':row.payment_status==='unpaid'?'Belum dibayar':row.payment_status}</span></div><h3>{row.device} · {row.device_model}</h3><p>{row.service_name} · {row.shop_name}</p><p className="muted">{row.customer?.name??'Pelanggan tidak tersedia'} · {date(row.created_at)}</p><p className="muted">Teknisi: {row.technician_name??'Belum ditugaskan'} <span className="admin-ticket-id">ID {row.id.slice(0,8).toUpperCase()}</span></p></div></article>}</PagedList>}
      <p className="muted">Perubahan status dan pembatalan dilakukan melalui alur pelanggan atau toko agar riwayat servis dan pembayaran tetap tercatat.</p>
    </section>
  </section>
}
