import { PagedList } from '../components/PagedList'
import { useEffect, useState } from 'react'
import { api, date } from '../api'
import { ActionForm } from '../components/ActionForm'

type Item = { ticket_id:string; event:number; status:string; created_at:string; device_model:string; shop_name:string; read:boolean }
const titles: Record<string,string> = {
  accepted:'Toko menerima permintaan',quoted:'Penawaran biaya tersedia',
  ready:'Perangkat siap diambil',cancelled:'Toko membatalkan tiket',
}
export function Notifications({ openTicket }: { openTicket: (id: string) => void }) {
  const [items,setItems] = useState<Item[] | null>(null)
  const [error,setError] = useState('')
  const [attempt,setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void api<Item[]>('/notifications').then(rows => { if (active) setItems(rows) },
      () => { if (active) setError('Notifikasi belum dapat dimuat.') })
    return () => { active = false }
  },[attempt])
  return <section className="wrap page narrow">
    <a className="back" href="?halaman=servis">← Lacak servis</a>
    <h1>Notifikasi servis</h1>
    {error ? <div className="panel"><p className="error" role="alert">{error}</p>
      <button className="button" onClick={() => { setError(''); setAttempt(value => value+1) }}>Muat ulang</button></div>
      : items === null ? <p role="status">Memuat notifikasi…</p>
        : items.length === 0 ? <p>Belum ada pembaruan dari toko.</p>
          : <PagedList items={items} label="notifikasi">{item => <article className="panel" key={item.ticket_id+':'+item.event}>
            {!item.read && <span className="status">Belum dibaca</span>}
            <h2>{titles[item.status]}</h2>
            <p>{item.device_model} · {item.shop_name}</p>
            <p className="muted"><time dateTime={item.created_at}>{date(item.created_at)}</time></p>
            {item.read ? <button className="button" onClick={() => openTicket(item.ticket_id)}>Buka tiket</button>
              : <ActionForm label="Buka tiket" onSend={async () => {
                await api('/notifications/read',{ ticket_id:item.ticket_id,event:item.event })
                openTicket(item.ticket_id)
              }}/>}
          </article>}</PagedList>}
  </section>
}

