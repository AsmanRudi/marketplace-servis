import { PagedList } from '../components/PagedList'
import { useEffect, useState } from 'react'
import { api, date, money, statuses, type Account, type Detail, type ManagedShop, type Ticket } from '../api'
import { ActionForm, field } from '../components/ActionForm'

const steps: Record<string,string[]> = {
  submitted:['accepted','cancelled'], accepted:['received','cancelled'], received:['diagnosis'], diagnosis:['cancelled'],
  approved:['repairing','parts'], repairing:['parts','ready'], parts:['repairing'], ready:['completed'],
}
const actionLabels: Record<string,string> = {
  accepted:'Terima permintaan', received:'Catat penerimaan', diagnosis:'Mulai diagnosis',
  repairing:'Mulai perbaikan', parts:'Tandai menunggu suku cadang', ready:'Tandai siap diambil',
  completed:'Catat pengambilan', cancelled:'Batalkan tiket',
}
export function Tickets({ account, ticket, setTicket, workbench = false }: { account: Account; ticket: string; setTicket: (id: string) => void; workbench?: boolean }) {
  const [orders,setOrders] = useState<Ticket[] | null>(null)
  const [detail,setDetail] = useState<Detail | null>(null)
  const [shops,setShops] = useState<ManagedShop[]>([])
  const [error,setError] = useState('')
  const [feedback,setFeedback] = useState('')
  const [query,setQuery] = useState('')
  const [statusFilter,setStatusFilter] = useState('')
  const [sort,setSort] = useState('newest')
  useEffect(() => {
    let active = true
    void api<Ticket[]>('/orders').then(rows => { if (active) setOrders(rows) },() => { if (active) setError('Daftar tiket belum dapat dimuat.') })
    if (account.memberships.some(m => m.role === 'manager')) {
      void api<ManagedShop[]>('/shops/manage').then(rows => { if (active) setShops(rows) },() => { if (active) setError('Daftar teknisi belum dapat dimuat.') })
    }
    return () => { active = false }
  },[account.id])
  useEffect(() => {
    let active = true
    if (ticket) void api<Detail>('/orders/' + ticket).then(row => { if (active) setDetail(row) },() => { if (active) setError('Tiket belum dapat dimuat.') })
    return () => { active = false }
  },[ticket])
  function select(id: string) {
    setError('')
    setFeedback('')
    setDetail(null)
    setTicket(id)
  }
  async function change(action: string, data: object) {
    await api('/orders/' + ticket + '/' + action,data)
    setFeedback('Perubahan tiket tersimpan.')
    const [updated,list] = await Promise.all([api<Detail>('/orders/' + ticket),api<Ticket[]>('/orders')])
    setDetail(updated)
    setOrders(list)
  }
  const visibleOrders = workbench ? orders?.filter(order => order.technician_id === account.id) : orders
  const search = query.trim().toLocaleLowerCase('id-ID')
  const filteredOrders = visibleOrders?.filter(order =>
    (!statusFilter || order.status === statusFilter) &&
    (!search || [order.id,order.device_model,order.shop_name,order.service_name].some(value => value.toLocaleLowerCase('id-ID').includes(search)))
  ).sort((a,b) => (sort === 'oldest' ? 1 : -1) * (Date.parse(a.created_at)-Date.parse(b.created_at))) ?? []
  const completed = visibleOrders?.filter(order => order.status === 'completed') ?? []
  const active = visibleOrders?.filter(order => !['completed','cancelled'].includes(order.status)) ?? []
  const covered = completed.filter(order => order.completed_at && order.warranty_days > 0 &&
    Date.now() <= new Date(order.completed_at).getTime()+order.warranty_days*86_400_000)
  return <section className="wrap page">
    {ticket && <button className="back link" onClick={() => select('')}>← Semua tiket</button>}
    <h1>{ticket ? 'Pelacakan dan garansi' : workbench ? 'Meja kerja teknisi' : 'Dashboard servis'}</h1>
    {!ticket && <div className="actions">
      <a className="text-action" href="?halaman=notifikasi">Buka notifikasi servis →</a>
      <a className="text-action" href="?halaman=kasus">Buka kasus servis →</a>
    </div>}
    {!ticket && <p className="muted">{workbench ? 'Tiket perbaikan yang ditugaskan ke akun Anda.' : 'Tiket, status pengerjaan, dan masa garansi perangkat Anda.'}</p>}
    {!ticket && visibleOrders && <dl className="design-stats">
      <div><dt>{workbench ? 'Pekerjaan aktif' : 'Servis berjalan'}</dt><dd>{active.length}</dd></div>
      <div><dt>Servis selesai</dt><dd>{completed.length}</dd></div>
      <div><dt>Garansi aktif</dt><dd>{covered.length}</dd></div>
    </dl>}
    {error && <p className="error" role="alert">{error}</p>}
    {feedback && <p role="status">{feedback}</p>}
    {!ticket && !!visibleOrders?.length && <div className="ticket-tools panel">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label>Cari tiket<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Perangkat, toko, layanan, atau nomor tiket"/></label>
        <label>Status servis<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="">Semua status</option>{Object.entries(statuses).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Urutan<select value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Terbaru dahulu</option><option value="oldest">Terlama dahulu</option></select></label>
      </div>
      <div className="actions"><p className="muted" role="status">{filteredOrders.length} dari {visibleOrders.length} tiket</p>
        {(query || statusFilter || sort !== 'newest') && <button className="link" onClick={() => { setQuery('');setStatusFilter('');setSort('newest') }}>Reset pencarian</button>}</div>
    </div>}
    {!ticket && (!visibleOrders ? !error && <p role="status">Memuat tiket…</p>
      : visibleOrders.length === 0 ? <div className="panel"><p>Belum ada tiket servis.</p><a className="button" href="?halaman=toko">Cari toko servis</a></div>
      : filteredOrders.length === 0 ? <p className="panel">Tidak ada tiket yang cocok. Ubah kata pencarian atau status servis.</p>
      : <PagedList items={filteredOrders} label="tiket servis" resetKey={JSON.stringify([query,statusFilter,sort])} className="ticket-list">{order =>
        <button className="ticket-row" key={order.id} onClick={() => select(order.id)}>
          <span><strong>{order.device_model}</strong><small>{order.shop_name} · {order.service_name}</small><small>#{order.id.slice(0,8).toUpperCase()} · {date(order.created_at)}</small></span><span className="status">{statuses[order.status]}</span>
        </button>}</PagedList>)}
    {ticket && (detail?.id === ticket
      ? <TicketDetails key={detail.id} detail={detail} account={account} shop={shops.find(shop => shop.id === detail.shop_id)} change={change}/>
      : !error && <p role="status">Memuat tiket…</p>)}
  </section>
}
function TicketDetails({ detail, account, shop, change }: {
  detail: Detail; account: Account; shop?: ManagedShop; change: (action: string, data: object) => Promise<void>
}) {
  const customer = detail.customer_id === account.id
  const manager = detail.role === 'manager'
  const canReport = customer && (detail.condition || !['submitted','accepted','cancelled'].includes(detail.status))
  const warrantyActive = detail.status === 'completed' && detail.completed_at && detail.warranty_days > 0 &&
    Date.now() <= new Date(detail.completed_at).getTime() + detail.warranty_days * 86_400_000
  const tech = detail.role === 'technician' && detail.technician_id === account.id
  const closed = ['completed','cancelled'].includes(detail.status)
  const onlineBlocksHandover = detail.checkout_status === 'pending' || detail.checkout_status === 'review_required'
  const available = (steps[detail.status] ?? []).filter(step =>
    (manager && (step !== 'completed' || (detail.payment && !onlineBlocksHandover))) ||
    (tech && ['diagnosis','repairing','parts','ready'].includes(step)) ||
    (customer && detail.status === 'submitted' && step === 'cancelled'))
  const approvedQuote = detail.quotes.find(quote => quote.status === 'approved')
  const bill = approvedQuote ? approvedQuote.labor + approvedQuote.parts : null
  const canQuote = (manager || tech) && ['diagnosis','quoted','approved','repairing','parts'].includes(detail.status)
  const [status,setStatus] = useState('')
  const selected = available.includes(status) ? status : available[0]
  const progress = ({ submitted:0,accepted:0,received:1,diagnosis:1,quoted:2,approved:2,repairing:3,parts:3,ready:4,completed:4 } as Record<string,number>)[detail.status]
  return <>
    {progress !== undefined && <ol className="tracker-line" aria-label="Tahap servis">
      {['Permintaan','Diagnosis','Persetujuan','Pengerjaan','Serah terima'].map((label,index) =>
        <li key={label} data-reached={index <= progress} aria-current={index === progress ? 'step' : undefined}>{index+1}. {label}</li>)}
    </ol>}
    <div className="detail-grid">
    <div>
      <article className="panel detail">
        <span className="status">{statuses[detail.status]}</span>
        <h2>{detail.device_model}</h2>
        <p>{detail.shop_name} · {detail.service_name}</p>
        <p className="muted ticket-code">Tiket {detail.id.slice(0,8).toUpperCase()} · {date(detail.created_at)}</p>
        <dl><dt>Kendala</dt><dd>{detail.complaint}</dd>
          {detail.dropoff_address && <><dt>Alamat toko</dt><dd>{detail.dropoff_address}</dd></>}
          {detail.completed_at && detail.warranty_days > 0 && <><dt>Garansi toko</dt><dd>{detail.warranty_days} hari sejak {date(detail.completed_at)}</dd></>}
          <dt>Teknisi</dt><dd>{detail.technician_name ?? 'Belum ditugaskan'}</dd>
          {detail.condition && <><dt>Kondisi saat diterima</dt><dd>{detail.condition}</dd></>}</dl>
      </article>
      {detail.has_case && (customer || manager) && <a className="text-action" href={'?halaman=kasus&tiket='+detail.id}>Buka kasus servis →</a>}
      {canReport && !detail.has_case && <ActionForm className="panel" label="Kirim pengajuan" onSend={async form => {
        await api('/cases/'+detail.id,{ kind:field(form,'kind'),message:field(form,'message') })
        window.location.assign('?halaman=kasus&tiket='+detail.id)
      }}>
        <h3>Komplain atau klaim servis</h3>
        <label>Jenis pengajuan<select name="kind"><option value="complaint">Komplain servis</option>{warrantyActive && <option value="warranty">Klaim garansi</option>}</select></label>
        <label>Rincian<textarea name="message" minLength={10} maxLength={1500} rows={4} required/></label>
      </ActionForm>}
      {detail.payment && <article className="panel">
        <h3>Bukti pencatatan pembayaran</h3>
        <p>{detail.payment.id.slice(0,8).toUpperCase()} · {date(detail.payment.recorded_at)}</p>
        <dl><dt>Nominal</dt><dd>{money(detail.payment.amount)}</dd>
          <dt>Metode</dt><dd>{{ cash:'Tunai', bank_transfer:'Transfer bank', no_charge:'Bebas biaya', midtrans_sandbox:'Midtrans sandbox' }[detail.payment.method]}</dd></dl>
      </article>}
      {detail.status === 'ready' && !detail.payment && bill !== null && <article className="panel">
        <h3>Tagihan servis</h3><p><strong>{money(bill)}</strong></p>
        <p className="muted">{detail.checkout_status === 'pending' ? 'Checkout sandbox sedang menunggu konfirmasi.' : 'Pembayaran di toko dicatat saat serah terima.'}</p>
        {customer && detail.online_enabled && bill > 0 && (!detail.checkout_status || detail.checkout_status === 'pending') &&
          <ActionForm label={detail.checkout_status ? 'Buka checkout sandbox' : 'Bayar di sandbox'} onSend={async () => {
            const checkout = await api<{ redirect_url:string }>('/orders/' + detail.id + '/checkout',{})
            window.location.assign(checkout.redirect_url)
          }}><p>Gunakan metode pembayaran uji coba Midtrans.</p></ActionForm>}
      </article>}
      {detail.checkout_status === 'review_required' && <p className="error" role="status">Pembayaran perlu diperiksa oleh toko sebelum serah terima.</p>}
      {detail.checkout_status === 'closed' && <p className="muted">Checkout sandbox sudah ditutup. Anda bisa membayar di toko.</p>}
      {detail.online_enabled && detail.checkout_status && (customer || manager) &&
        <ActionForm className="panel" label="Periksa status checkout" onSend={() => change('checkout/status',{})}>
          <h3>Konfirmasi Midtrans</h3>
        </ActionForm>}
      {detail.quotes.map(quote => <article className="panel" key={quote.id}>
        <h3>Penawaran biaya</h3>
        <p className="muted">{{ pending:'Menunggu persetujuan', approved:'Disetujui', rejected:'Ditolak', superseded:'Digantikan' }[quote.status]}</p>
        <p>{quote.diagnosis}</p><dl><dt>Jasa</dt><dd>{money(quote.labor)}</dd><dt>Suku cadang</dt><dd>{money(quote.parts)}</dd><dt>Total</dt><dd><strong>{money(quote.labor + quote.parts)}</strong></dd><dt>Estimasi waktu</dt><dd>{quote.duration}</dd></dl>
        {customer && quote.status === 'pending' && <ActionForm label="Kirim keputusan" onSend={form => change('decision',{ quote_id:quote.id, approve:field(form,'decision') === 'approve' })}>
          <label>Keputusan<select name="decision" required defaultValue=""><option value="" disabled>Pilih keputusan</option><option value="approve">Setujui biaya</option><option value="reject">Tolak penawaran</option></select></label>
        </ActionForm>}
      </article>)}
      {customer && detail.status === 'completed' && !detail.review && <ActionForm className="panel" label="Kirim ulasan" onSend={form => change('review',{ rating:Number(field(form,'rating')), comment:field(form,'comment'), public:form.has('public') })}>
        <h3>Ulasan servis</h3><label>Penilaian<select name="rating">{[5,4,3,2,1].map(n => <option key={n}>{n}</option>)}</select></label>
        <label>Komentar<textarea name="comment" rows={3} minLength={3} maxLength={500} required/></label>
        <label className="product-check"><input type="checkbox" name="public"/> Izinkan tampil di beranda tanpa nama akun</label>
      </ActionForm>}
      {detail.review && <article className="panel"><h3>Ulasan servis · {detail.review.rating}/5</h3><p>{detail.review.comment}</p>
        {customer && <ActionForm label={detail.review.public ? 'Jadikan privat' : 'Izinkan tampil di beranda'}
          onSend={() => change('review/visibility',{ public:!detail.review?.public })}>
          <p className="muted">{detail.review.public ? 'Anda mengizinkan komentar ditampilkan tanpa nama akun.' : 'Ulasan ini privat. Hapus informasi pribadi dari komentar sebelum mengizinkan publikasi.'}</p>
        </ActionForm>}
      </article>}
    </div>
    <div>
      {manager && !closed && shop && shop.technicians.length > 0 && <ActionForm key={'assignment-' + detail.technician_id} className="panel" label="Simpan penugasan"
        onSend={form => change('assign',{ technician_id:field(form,'technician_id') })}>
        <label>Teknisi yang ditugaskan<select name="technician_id" required defaultValue={detail.technician_id ?? detail.preferred_id ?? ''}>
          <option value="" disabled>Pilih teknisi</option>{shop.technicians.map(t => <option key={t.id} value={t.id}>{t.name}{t.id === detail.preferred_id ? ' · Pilihan pelanggan' : ''}</option>)}
        </select></label>
      </ActionForm>}
      {manager && detail.status === 'ready' && !detail.payment && !onlineBlocksHandover && bill !== null && <ActionForm className="panel"
        label="Catat pembayaran" onSend={form => change('payment',{ method:field(form,'method'), amount:Number(field(form,'amount')) })}>
        <h3>Pembayaran di toko</h3>
        <label>Metode<select name="method" required defaultValue={bill === 0 ? 'no_charge' : ''}>
          {bill === 0 ? <option value="no_charge">Bebas biaya</option> : <>
            <option value="" disabled>Pilih metode</option><option value="cash">Tunai</option><option value="bank_transfer">Transfer bank</option>
          </>}
        </select></label>
        <label>Nominal diterima (Rp)<input name="amount" type="number" min={0} max={200000000} required defaultValue={bill === 0 ? 0 : undefined}/></label>
      </ActionForm>}
      {selected && <ActionForm key={detail.status} className="panel" label="Simpan status" onSend={form => change('status',{ status:field(form,'status'), condition:field(form,'condition') || undefined })}>
        <label>Perubahan status<select name="status" value={selected} onChange={event => setStatus(event.target.value)}>{available.map(value => <option key={value} value={value}>{actionLabels[value]}</option>)}</select></label>
        {selected === 'received' && <label>Kondisi dan kelengkapan<textarea name="condition" rows={3} minLength={3} maxLength={500} required/></label>}
      </ActionForm>}
      {canQuote && <ActionForm key={detail.quotes[0]?.id ?? 'new'} className="panel" label="Kirim penawaran" onSend={form => change('quotes',{
        diagnosis:field(form,'diagnosis'), labor:Number(field(form,'labor')), parts:Number(field(form,'parts')), duration:field(form,'duration'),
      })}>
        <h3>{detail.quotes.length ? 'Revisi penawaran' : 'Buat penawaran'}</h3>
        <label>Hasil diagnosis<textarea name="diagnosis" rows={3} minLength={3} maxLength={1000} required/></label>
        <label>Biaya jasa (Rp)<input name="labor" type="number" min={0} max={100000000} required/></label>
        <label>Suku cadang (Rp)<input name="parts" type="number" min={0} max={100000000} required/></label>
        <label>Estimasi waktu<input name="duration" minLength={2} maxLength={100} required/></label>
      </ActionForm>}
      <article className="panel"><h3>Riwayat pengerjaan</h3><ol className="timeline">{[...detail.events].reverse().map((event,index) =>
        <li key={index}><strong>{statuses[event.status]}</strong><time dateTime={event.created_at}>{date(event.created_at)}</time>{event.note && <p>{event.note}</p>}</li>
      )}</ol></article>
    </div>
  </div></>
}
