import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api, apiMethod, date, uploadPhoto } from '../api'
import { PagedList } from '../components/PagedList'

type Section = 'users'|'shops'|'technicians'
type UserRow = { id:string; name:string; email:string; platform_admin:boolean; disabled:boolean; created_at:string|null; photo_url:string|null; memberships:string[] }
type ShopRow = { id:string; name:string; city:string; district:string; description:string; dropoff_address:string|null; photo_url:string|null; verified:boolean; demo:boolean; created_at:string; members:number; technicians:number; products:number }
type TechnicianRow = { id:string; name:string; email:string; specialty:string; city:string; verified:boolean; disabled:boolean; photo_url:string|null; kind:'independent'|'anggota toko'; created_at:string|null; shops:string[] }
type Row = UserRow|ShopRow|TechnicianRow

const config:Record<Section,{ title:string; intro:string; endpoint:string; search:string }> = {
  users:{ title:'Kelola pengguna',intro:'Tinjau akun dan akses pengguna platform.',endpoint:'/admin/users',search:'Cari nama atau email' },
  shops:{ title:'Kelola toko',intro:'Pantau status verifikasi dan aktivitas toko mitra.',endpoint:'/admin/shops',search:'Cari nama toko atau kota' },
  technicians:{ title:'Kelola teknisi',intro:'Tinjau pengajuan teknisi perorangan dan anggota toko.',endpoint:'/admin/technicians',search:'Cari nama, keahlian, atau kota' },
}
const isUser = (row:Row):row is UserRow => 'email' in row && 'platform_admin' in row
const isShop = (row:Row):row is ShopRow => 'district' in row
const isTech = (row:Row):row is TechnicianRow => 'specialty' in row

export function AdminManagement({ section }: { section:Section }) {
  const [rows,setRows] = useState<Row[]|null>(null)
  const [query,setQuery] = useState('')
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const [busy,setBusy] = useState('')
  const [retry,setRetry] = useState(0)
  const current = config[section]
  useEffect(() => {
    let active = true
    void api<Row[]>(current.endpoint).then(result => { if (active) setRows(result) },failure => { if (active) setError(failure instanceof Error ? failure.message : 'Data belum dapat dimuat.') })
    return () => { active=false }
  },[current.endpoint,retry])
  const filtered = useMemo(() => rows?.filter(row => JSON.stringify(row).toLocaleLowerCase('id').includes(query.trim().toLocaleLowerCase('id'))),[rows,query])
  const count = rows?.length ?? 0
  const pending = rows?.filter(row => section === 'users' ? isUser(row)&&row.disabled : isShop(row) ? !row.verified : isTech(row) ? row.kind === 'independent' && !row.verified : false).length ?? 0
  async function update(row:Row) {
    const id=row.id
    setBusy(id);setError('');setNotice('')
    try {
      if (isUser(row)) {
        const disabled=!row.disabled
        await api('/admin/users/'+encodeURIComponent(id)+'/status',{ disabled })
        setRows(items=>items?.map(item=>isUser(item)&&item.id===id?{...item,disabled}:item)??null)
        setNotice(`${row.name} ${disabled?'dinonaktifkan':'diaktifkan'}.`)
      } else if (isShop(row)) {
        const verified=!row.verified
        await api('/admin/shops/'+encodeURIComponent(id)+'/verification',{ verified })
        setRows(items=>items?.map(item=>isShop(item)&&item.id===id?{...item,verified}:item)??null)
        setNotice(`Toko ${row.name} ${verified?'diverifikasi':'ditangguhkan dari katalog publik'}.`)
      } else if (isTech(row)&&row.kind==='independent') {
        const verified=!row.verified
        await api('/admin/technicians/'+encodeURIComponent(id)+'/verification',{ verified })
        setRows(items=>items?.map(item=>isTech(item)&&item.id===id?{...item,verified}:item)??null)
        setNotice(`Profil teknisi ${row.name} ${verified?'disetujui':'dikembalikan ke antrean tinjauan'}.`)
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Perubahan belum dapat disimpan.') }
    finally { setBusy('') }
  }
  async function saveRecord(event:FormEvent<HTMLFormElement>, row?:Row) {
    event.preventDefault()
    const form=event.currentTarget, fields=new FormData(form), value=(key:string)=>String(fields.get(key)??'').trim()
    const editing=Boolean(row)
    setError('');setNotice('')
    try {
      if(section==='users') {
        const body={name:value('name'),email:value('email'),photo_url:value('photo_url')||null,...(value('password')?{password:value('password')}:{})}
        await (editing?apiMethod('/admin/users/'+encodeURIComponent(row!.id),'PUT',body):api('/admin/users',body))
      } else if(section==='shops') {
        const body={name:value('name'),city:value('city'),district:value('district'),description:value('description'),dropoff_address:value('dropoff_address')||null,photo_url:value('photo_url')||null,...(!editing?{manager_email:value('manager_email')}: {})}
        await (editing?apiMethod('/admin/shops/'+encodeURIComponent(row!.id),'PUT',body):api('/admin/shops',body))
      } else if(section==='technicians'&&row&&isTech(row)) {
        await apiMethod('/admin/technicians/'+encodeURIComponent(row.id),'PUT',{...(row.kind==='independent'?{specialty:value('specialty'),city:value('city')}:{}),photo_url:value('photo_url')||null})
      }
      setNotice(editing?'Perubahan berhasil disimpan.':'Data baru berhasil ditambahkan.')
      setRetry(value=>value+1);form.reset()
    } catch(failure) { setError(failure instanceof Error?failure.message:'Perubahan belum dapat disimpan.') }
  }
  async function remove(row:Row) {
    if(!window.confirm(`Hapus ${row.name}? Jika data memiliki riwayat, sistem akan menolak penghapusan agar catatan tetap utuh.`)) return
    setBusy(row.id);setError('');setNotice('')
    try {
      const endpoint=isUser(row)?'/admin/users/':isShop(row)?'/admin/shops/':'/admin/technicians/'
      await apiMethod(endpoint+encodeURIComponent(row.id),'DELETE')
      setNotice(`${row.name} berhasil dihapus.`);setRetry(value=>value+1)
    } catch(failure) { setError(failure instanceof Error?failure.message:'Data belum dapat dihapus.') }
    finally { setBusy('') }
  }
  return <section className="wrap page admin-management">
    <div className="admin-hero"><div><p className="admin-kicker">ADMIN PLATFORM · PENGELOLAAN</p><h1>{current.title}</h1><p>{current.intro}</p></div><div className="admin-manage-total"><strong>{rows?count:'—'}</strong><span>{section==='users'?'akun':section==='shops'?'toko':'teknisi'}</span></div></div>
    <div className="admin-manage-stats"><div><span>Jumlah data</span><strong>{rows?count:'—'}</strong></div><div><span>{section==='users'?'Perlu diperhatikan':'Menunggu tinjauan'}</span><strong>{rows?pending:'—'}</strong></div><div><span>Status halaman</span><strong>{rows?'Aktif':'Memuat'}</strong></div></div>
    {notice&&<p className="design-summary" role="status">{notice}</p>}
    {error&&<div className="panel admin-manage-error"><p className="error" role="alert">{error}</p><button className="button" onClick={()=>{setError('');setRetry(value=>value+1)}}>Muat ulang</button></div>}
    <section className="admin-card admin-manage-list" aria-label={current.title}>
      <div className="admin-section-head"><div><p className="admin-kicker">DIREKTORI PLATFORM</p><h2 className="admin-heading">Daftar {section==='users'?'akun':section==='shops'?'toko':'teknisi'}</h2></div><label className="admin-product-filter">Cari<input value={query} onChange={event=>setQuery(event.target.value)} placeholder={current.search}/></label></div>
      {(section==='users'||section==='shops')&&<details className="admin-crud-form" key={'create-'+section+'-'+retry}><summary>Tambah {section==='users'?'akun pengguna':'toko'}</summary><form onSubmit={event=>void saveRecord(event)}>
        <label>Nama<input name="name" minLength={2} maxLength={100} required/></label>
        {section==='users'?<><label>Email<input name="email" type="email" required/></label><PhotoField name="photo_url" label="Foto profil"/><label>Kata sandi sementara (minimal 10 karakter)<input name="password" type="password" minLength={10} required/></label></>:<><label>Kota<input name="city" minLength={2} maxLength={80} required/></label><label>Kecamatan<input name="district" minLength={2} maxLength={80} required/></label><label>Alamat serah terima<input name="dropoff_address" minLength={10} maxLength={200} required/></label><label>Deskripsi<input name="description" minLength={10} maxLength={500} required/></label><PhotoField name="photo_url" label="Foto konter"/><label>Email pengelola terdaftar<input name="manager_email" type="email" required/></label></>}
        <button className="button" type="submit">Simpan data</button>
      </form></details>}
      {!rows&&!error&&<p role="status">Memuat data…</p>}
      {filtered?.length===0&&<p className="admin-empty">Tidak ada data yang sesuai. Coba kata pencarian lain.</p>}
      {filtered&&<PagedList items={filtered} label={current.title} resetKey={query+section} size={10} className="admin-manage-grid">{row=>{
        const key=row.id
        return <article className="admin-manage-row" key={key}>
          <div className="admin-manage-avatar">{(isUser(row)||isShop(row)||isTech(row))&&row.photo_url?<img src={row.photo_url} alt={'Foto '+(isUser(row)?'profil':isShop(row)?'konter':'teknisi')+' '+row.name} loading="lazy"/>:<span aria-hidden="true">{row.name.trim().slice(0,1).toLocaleUpperCase('id')}</span>}</div>
          <div className="admin-manage-main">
            {isUser(row)&&<><div className="admin-manage-top"><span className={'admin-product-state'+(!row.disabled?' is-visible':'')}>{row.disabled?'Dinonaktifkan':'Aktif'}</span>{row.platform_admin&&<span className="design-flag">Super admin</span>}</div><h3>{row.name}</h3><p>{row.email}</p><p className="muted">{row.memberships.length?row.memberships.join(' · '):'Akun pelanggan'}{row.created_at?' · '+date(row.created_at):''}</p>{row.platform_admin?<><span className="admin-managed-protected">Akun admin dilindungi</span><details className="admin-crud-form"><summary>Edit foto profil</summary><form onSubmit={event=>void saveRecord(event,row)}><input type="hidden" name="name" value={row.name}/><input type="hidden" name="email" value={row.email}/><PhotoField key={row.id+'-'+retry} name="photo_url" label="Foto profil" value={row.photo_url}/><button className="button">Simpan foto</button></form></details></>:<><button className="admin-visibility-button" disabled={busy===key} onClick={()=>void update(row)}>{busy===key?'Menyimpan…':row.disabled?'Aktifkan akun':'Nonaktifkan akun'}</button><details className="admin-crud-form"><summary>Edit akun</summary><form onSubmit={event=>void saveRecord(event,row)}><label>Nama<input name="name" defaultValue={row.name} required/></label><label>Email<input name="email" type="email" defaultValue={row.email} required/></label><PhotoField key={row.id+'-'+retry} name="photo_url" label="Foto profil" value={row.photo_url}/><button className="button">Simpan edit</button></form></details><button className="admin-delete-button" disabled={busy===key} onClick={()=>void remove(row)}>Hapus akun</button></>}</>}
            {isShop(row)&&<><div className="admin-manage-top"><span className={'admin-product-state'+(row.verified?' is-visible':'')}>{row.verified?'Terverifikasi':'Menunggu verifikasi'}</span>{row.demo&&<span className="design-flag">Demo</span>}</div><h3>{row.name}</h3><p>{row.district}, {row.city}</p><p className="muted">{row.members} anggota · {row.technicians} teknisi · {row.products} produk{row.created_at?' · '+date(row.created_at):''}</p><button className="admin-visibility-button" disabled={busy===key} onClick={()=>void update(row)}>{busy===key?'Menyimpan…':row.verified?'Tangguhkan publikasi':'Verifikasi toko'}</button><details className="admin-crud-form"><summary>Edit toko</summary><form onSubmit={event=>void saveRecord(event,row)}><label>Nama<input name="name" defaultValue={row.name} required/></label><label>Kota<input name="city" defaultValue={row.city} required/></label><label>Kecamatan<input name="district" defaultValue={row.district} required/></label><label>Deskripsi<input name="description" defaultValue={row.description} required/></label><label>Alamat serah terima<input name="dropoff_address" defaultValue={row.dropoff_address??''}/></label><PhotoField key={row.id+'-'+retry} name="photo_url" label="Foto konter" value={row.photo_url}/><button className="button">Simpan edit</button></form></details><button className="admin-delete-button" disabled={busy===key} onClick={()=>void remove(row)}>Hapus toko</button></>}
            {isTech(row)&&<><div className="admin-manage-top"><span className={'admin-product-state'+(row.verified?' is-visible':'')}>{row.kind==='independent'?(row.verified?'Profil disetujui':'Perlu tinjauan'):'Anggota toko'}</span>{row.disabled&&<span className="admin-product-state">Akun nonaktif</span>}</div><h3>{row.name}</h3><p>{row.specialty} · {row.city}</p><p className="muted">{row.email||'Email tidak tersedia'}{row.shops.length?' · '+row.shops.join(', '):' · Belum bergabung ke toko'}</p>{row.kind==='independent'&&<button className="admin-visibility-button" disabled={busy===key||row.disabled} onClick={()=>void update(row)}>{busy===key?'Menyimpan…':row.verified?'Batalkan persetujuan':'Setujui profil teknisi'}</button>}<details className="admin-crud-form"><summary>{row.kind==='independent'?'Edit profil':'Edit foto teknisi'}</summary><form onSubmit={event=>void saveRecord(event,row)}>{row.kind==='independent'&&<><label>Keahlian<input name="specialty" defaultValue={row.specialty} required/></label><label>Kota<input name="city" defaultValue={row.city} required/></label></>}<PhotoField key={row.id+'-'+retry} name="photo_url" label="Foto teknisi" value={row.photo_url} shape="profile"/><button className="button">Simpan edit</button></form></details>{row.kind==='independent'&&<button className="admin-delete-button" disabled={busy===key} onClick={()=>void remove(row)}>Hapus profil</button>}</>}
          </div>
        </article>
      }}</PagedList>}
    </section>
  </section>
}

function PhotoField({name,label,value=null,shape='shop'}:{name:string;label:string;value?:string|null;shape?:'shop'|'profile'}) {
  const [url,setUrl]=useState(value??'')
  const [preview,setPreview]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  async function select(file?:File) {
    setError('');setPreview('')
    if(!file)return
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('Pilih foto JPG, PNG, atau WebP.');return}
    if(file.size>5*1024*1024){setError('Ukuran foto maksimal 5 MB.');return}
    setPreview(URL.createObjectURL(file));setBusy(true)
    try {setUrl(await uploadPhoto(file))} catch(failure) {setError(failure instanceof Error?failure.message:'Foto belum dapat diunggah.');setUrl(value??'')}
    finally {setBusy(false)}
  }
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview])
  return <div className="admin-photo-field"><label>{label}<input type="hidden" name={name} value={url}/><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>void select(event.target.files?.[0])}/></label><small>{shape==='profile'?'Disarankan 512 × 512 px, persegi.':'Disarankan 1200 × 800 px, rasio 3:2.'} JPG, PNG, atau WebP · maksimal 5 MB.</small>{error&&<small className="error" role="alert">{error}</small>}{busy&&<small role="status">Mengunggah foto…</small>}{(preview||url)&&<img className={shape==='profile'?'is-profile':''} src={preview||url} alt={'Pratinjau '+label.toLocaleLowerCase('id')} loading="lazy"/>}</div>
}
