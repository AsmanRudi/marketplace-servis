import { PagedList } from '../components/PagedList'
import { useEffect, useState } from 'react'
import { api, money, type Account, type ManagedShop } from '../api'
import { ShopProducts } from './Products'
import { ActionForm, field } from '../components/ActionForm'

export function Workspace({ account, onChange }: { account: Account; onChange: () => void }) {
  const [shops,setShops] = useState<ManagedShop[] | null>(null)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  useEffect(() => {
    let active = true
    void api<ManagedShop[]>('/shops/manage').then(rows => { if (active) setShops(rows) },() => { if (active) setError('Daftar toko belum dapat dimuat.') })
    return () => { active = false }
  },[account.id])
  async function save(path: string, data: object, message: string) {
    await api(path,data)
    setNotice(message)
    setShops(await api<ManagedShop[]>('/shops/manage'))
    onChange()
  }
  return <section className="wrap page"><h1>Kemitraan toko servis</h1>
    <div className="design-summary"><p><strong>Workshop dan gerai fisik</strong></p><p>Daftarkan gerai untuk menerima perangkat dan mengelola katalog layanan setelah verifikasi.</p></div>
    <p className="muted">Kelola profil toko, layanan, dan teknisi. Pekerjaan servis tersedia di daftar tiket.</p>
    <a className="text-action" href="?halaman=servis">Buka daftar tiket →</a> <a className="text-action" href="?halaman=kasus">Buka kasus servis →</a>
    {account.memberships.some(member => member.role === 'technician') && <a className="text-action ml-4" href="?halaman=workbench">Buka meja kerja teknisi →</a>}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <div className="detail-grid">
      <div>{shops && <PagedList items={shops} label="toko yang dikelola" size={3}>{shop => <article className="panel" key={shop.id}>
        <h2>{shop.name}</h2><p>{shop.district}, {shop.city}</p>
        {shop.dropoff_address && <p>{shop.dropoff_address}</p>}
        <span className="status">{shop.verified ? 'Terverifikasi' : 'Menunggu verifikasi'}</span>
        {account.platform_admin && !shop.verified && <ActionForm className="inner-form" label="Verifikasi toko" onSend={() => save('/shops/' + shop.id + '/verify',{},'Toko telah diverifikasi.')}>
          <p>{shop.description}</p>
        </ActionForm>}
        {shop.role === 'manager' && <>
          <ActionForm label="Simpan foto dan lokasi" onSend={form => {
            const latitude = field(form,'latitude'), longitude = field(form,'longitude')
            return save('/shops/'+shop.id+'/profile',{
              photo_url:field(form,'photo_url').trim() || null,
              latitude:latitude === '' ? null : Number(latitude),longitude:longitude === '' ? null : Number(longitude),
            },'Foto dan lokasi toko tersimpan.')
          }}>
            <label>URL foto toko (HTTPS)<input name="photo_url" type="url" maxLength={1500} defaultValue={shop.photo_url?.startsWith('https://') ? shop.photo_url : ''}/></label>
            <label>Lintang<input name="latitude" type="number" min={-90} max={90} step="any" defaultValue={shop.location?.coordinates[1]}/></label>
            <label>Bujur<input name="longitude" type="number" min={-180} max={180} step="any" defaultValue={shop.location?.coordinates[0]}/></label>
          </ActionForm>
          <ShopProducts shopId={shop.id}/>
          <h3>Layanan</h3><ul>{shop.services.map(s => <li key={s.id}>{s.name} · {money(s.starting_price)}</li>)}</ul>
          <ActionForm label="Tambah layanan" onSend={async (form,event) => {
            const element = event.target as HTMLFormElement
            await save('/shops/' + shop.id + '/services',{ name:field(form,'name'), device:field(form,'device'), starting_price:Number(field(form,'starting_price')), warranty_days:Number(field(form,'warranty_days')) },'Layanan ditambahkan.')
            element.reset()
          }}>
            <label>Nama layanan<input name="name" minLength={2} maxLength={100} required/></label>
            <label>Perangkat<select name="device"><option>HP</option><option>Laptop</option></select></label>
            <label>Harga mulai (Rp)<input name="starting_price" type="number" min={0} max={100000000} required/></label>
            <label>Garansi (hari)<input name="warranty_days" type="number" min={0} max={730} defaultValue={0} required/></label>
          </ActionForm>
          <h3>Teknisi</h3><ul>{shop.technicians.map(t => <li key={t.id}>{t.name}</li>)}</ul>
          <ActionForm label="Simpan teknisi" onSend={async (form,event) => {
            const element = event.target as HTMLFormElement
            await save('/shops/' + shop.id + '/technicians',{ email:field(form,'email'), specialty:field(form,'specialty') },'Teknisi tersimpan.')
            element.reset()
          }}>
            <label>Email akun teknisi<input name="email" type="email" maxLength={254} required/></label>
            <label>Spesialisasi<input name="specialty" minLength={2} maxLength={100} required/></label>
          </ActionForm>
        </>}
      </article>}</PagedList>}
      {shops?.length === 0 && <p>Belum ada toko yang dikelola akun ini.</p>}
      </div>
      <ActionForm className="panel" label="Ajukan verifikasi toko" onSend={async (form,event) => {
        const element = event.target as HTMLFormElement
        await save('/shops',{ name:field(form,'name'), city:field(form,'city'), district:field(form,'district'), dropoff_address:field(form,'dropoff_address'), description:field(form,'description') },'Pengajuan toko terkirim.')
        element.reset()
      }}>
        <h2>Identitas toko</h2>
        <p className="muted">Isi data gerai yang digunakan untuk serah terima perangkat.</p>
        <label>Nama toko<input name="name" minLength={2} maxLength={100} required/></label>
        <label>Kota<input name="city" minLength={2} maxLength={80} required/></label>
        <label>Kecamatan<input name="district" minLength={2} maxLength={80} required/></label>
        <label>Alamat serah terima<input name="dropoff_address" minLength={10} maxLength={200} required/></label>
        <label>Deskripsi dan layanan utama<textarea name="description" rows={4} minLength={10} maxLength={500} required/></label>
      </ActionForm>
    </div>
  </section>
}
