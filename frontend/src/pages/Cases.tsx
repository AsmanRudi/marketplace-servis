import { PagedList } from '../components/PagedList'
import { useEffect, useState } from 'react'
import { api, date } from '../api'
import { ActionForm, field } from '../components/ActionForm'

type Case = {
  ticket_id:string; shop_name:string; device_model:string; role?:'customer'|'manager'|'admin';
  case:{ kind:string; status:string; updated_at:string; messages:{ role:string; message:string; created_at:string }[] };
}
const statuses:Record<string,string> = { open:'Diajukan',in_review:'Sedang ditinjau',resolved:'Selesai' }
const roles:Record<string,string> = { customer:'Pelanggan',manager:'Pengelola toko',admin:'Admin platform' }
const title = (item:Case) => item.case.kind === 'warranty' ? 'Klaim garansi' : 'Komplain servis'

export function Cases({ admin = false }: { admin?:boolean }) {
  const listUrl = admin ? '/admin/kasus' : '/?halaman=kasus'
  const ticket = new URLSearchParams(location.search).get('tiket')
  const [list,setList] = useState<Case[] | null>(null)
  const [detail,setDetail] = useState<Case|null>(null)
  const [error,setError] = useState('')
  useEffect(() => {
    let active = true
    const failed = () => { if (active) setError('Kasus belum dapat dimuat.') }
    if (ticket) void api<Case>('/cases/'+encodeURIComponent(ticket)).then(item => { if (active) setDetail(item) },failed)
    else void api<Case[]>('/cases').then(items => { if (active) setList(items) },failed)
    return () => { active=false }
  },[ticket])
  return <section className="wrap page narrow">
    <a className="back" href={ticket ? listUrl : admin ? '/admin' : '/?halaman=servis'}>{ticket ? '← Daftar kasus' : admin ? '← Dashboard admin' : '← Lacak servis'}</a>
    <h1>{detail ? title(detail) : 'Kasus servis'}</h1>
    {error && <p className="error" role="alert">{error}</p>}
    {!error && !detail && list === null && <p role="status">Memuat kasus…</p>}
    {list?.length === 0 && <p>Belum ada komplain atau klaim garansi.</p>}
    {list && <PagedList items={list} label="kasus servis">{item => <article className="panel" key={item.ticket_id}>
      <span className="status">{statuses[item.case.status]}</span>
      <h2>{title(item)}</h2><p>{item.device_model} · {item.shop_name}</p>
      <a className="button" href={listUrl+(admin ? '?' : '&')+'tiket='+encodeURIComponent(item.ticket_id)}>Buka kasus</a>
    </article>}</PagedList>}
    {detail && <>
      <p>{detail.device_model} · {detail.shop_name}</p>
      <span className="status">{statuses[detail.case.status]}</span>
      {detail.case.messages.map((entry,index) => <article className="panel" key={index}>
        <h2>{roles[entry.role]}</h2><p className="muted">{date(entry.created_at)}</p><p>{entry.message}</p>
      </article>)}
      {detail.case.status !== 'resolved' &&
        <ActionForm className="panel" label="Kirim tanggapan" onSend={async (form,event) => {
          const formElement = event.currentTarget ?? event.target as HTMLFormElement
          await api('/cases/'+detail.ticket_id+'/reply',{ message:field(form,'message'),status:field(form,'status') || undefined })
          setDetail(await api<Case>('/cases/'+detail.ticket_id))
          formElement.reset()
        }}>
          {detail.role !== 'customer' && <label>Status kasus<select name="status">
            <option value="">Pertahankan status</option><option value="in_review">Sedang ditinjau</option><option value="resolved">Tutup kasus</option>
          </select></label>}
          <label>Tanggapan<textarea name="message" required minLength={3} maxLength={1500} rows={4}/></label>
        </ActionForm>}
    </>}
  </section>
}

