import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api, apiMethod, money, uploadPhoto } from '../api'
import { PagedList } from '../components/PagedList'

type AdminProduct = { id:string; shop_id:string; name:string; category:string; condition:'new'|'used'; description:string; price:number; stock:number; warranty_days:number; photo_url:string|null; condition_notes:string|null; inspection_notes?:string|null; published:boolean; shop_name?:string; shop_city?:string }
type ShopOption = { id:string; name:string; city:string }
const categoryNames:Record<string,string> = { phone:'HP',laptop:'Laptop',phone_accessory:'Aksesori HP',laptop_accessory:'Aksesori laptop' }

export function AdminProducts() {
  const [items,setItems] = useState<AdminProduct[]|null>(null)
  const [error,setError] = useState('')
  const [query,setQuery] = useState('')
  const [filter,setFilter] = useState<'all'|'visible'|'hidden'>('all')
  const [busy,setBusy] = useState('')
  const [notice,setNotice] = useState('')
  const [revision,setRevision] = useState(0)
  const [shops,setShops] = useState<ShopOption[]>([])
  useEffect(() => {
    let active = true
    void Promise.all([api<AdminProduct[]>('/admin/products'),api<ShopOption[]>('/admin/shops')]).then(([rows,stores]) => { if (active) {setItems(rows);setShops(stores)} },failure => { if (active) setError(failure instanceof Error?failure.message:'Katalog produk belum dapat dimuat.') })
    return () => { active=false }
  },[revision])
  const results = useMemo(() => items?.filter(item =>
    (filter === 'all' || item.published === (filter === 'visible')) &&
    `${item.name} ${item.shop_name ?? ''} ${item.shop_city ?? ''}`.toLocaleLowerCase('id').includes(query.trim().toLocaleLowerCase('id'))
  ),[items,filter,query])
  async function toggle(item:AdminProduct) {
    setBusy(item.id);setNotice('');setError('')
    try {
      await api('/admin/products/'+encodeURIComponent(item.id)+'/visibility',{ published:!item.published })
      setItems(rows => rows?.map(row => row.id === item.id ? { ...row,published:!item.published } : row) ?? null)
      setNotice(`${item.name} ${item.published ? 'disembunyikan dari' : 'ditampilkan di'} katalog.`)
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Status produk belum dapat diperbarui.') }
    finally { setBusy('') }
  }
  async function saveProduct(event:FormEvent<HTMLFormElement>,item?:AdminProduct) {
    event.preventDefault();const form=event.currentTarget,data=new FormData(form),get=(name:string)=>String(data.get(name)??'').trim()
    const body={shop_id:get('shop_id'),name:get('name'),category:get('category'),condition:get('condition'),description:get('description'),price:Number(get('price')),stock:Number(get('stock')),warranty_days:Number(get('warranty_days')),photo_url:get('photo_url')||null,condition_notes:get('condition_notes')||null,inspection_notes:get('inspection_notes')||null}
    setError('');setNotice('')
    try { if(item) await apiMethod('/admin/products/'+encodeURIComponent(item.id),'PUT',body); else await api('/admin/products',body); setNotice(item?'Produk berhasil diperbarui.':'Produk berhasil ditambahkan.');setRevision(value=>value+1);form.reset() }
    catch(failure) { setError(failure instanceof Error?failure.message:'Produk belum dapat disimpan.') }
  }
  async function removeProduct(item:AdminProduct) {
    if(!window.confirm(`Hapus produk ${item.name}? Produk yang sudah dihapus tidak dapat dipulihkan.`)) return
    setBusy(item.id);setError('')
    try { await apiMethod('/admin/products/'+encodeURIComponent(item.id),'DELETE');setItems(rows=>rows?.filter(row=>row.id!==item.id)??null);setNotice(`${item.name} dihapus.`) }
    catch(failure) { setError(failure instanceof Error?failure.message:'Produk belum dapat dihapus.') }
    finally { setBusy('') }
  }
  const visibleCount = items?.filter(item => item.published).length ?? 0
  return <section className="wrap page admin-products">
    <div className="admin-hero"><div><p className="admin-kicker">KATALOG · MODERASI</p><h1>Kelola produk</h1><p>Tinjau katalog lintas toko dan atur produk yang tampil untuk pelanggan.</p></div><a className="admin-refresh" href="/?halaman=produk">Lihat katalog ↗</a></div>
    <div className="admin-product-summary"><div><span>Total produk</span><strong>{items?.length ?? '—'}</strong></div><div><span>Tampil di katalog</span><strong>{items ? visibleCount : '—'}</strong></div><div><span>Disembunyikan</span><strong>{items ? items.length-visibleCount : '—'}</strong></div></div>
    {notice && <p className="design-summary" role="status">{notice}</p>}
    {error && <div className="panel" role="alert"><p className="error">{error}</p><button className="button" onClick={() => { setError('');setRevision(value => value+1) }}>Coba lagi</button></div>}
    <section className="admin-card admin-product-list" aria-labelledby="admin-product-heading">
      <details className="admin-crud-form"><summary>Tambah produk</summary><ProductForm shops={shops} onSave={event=>void saveProduct(event)}/></details>
      <div className="admin-section-head"><div><p className="admin-kicker">SEMUA TOKO</p><h2 id="admin-product-heading" className="admin-heading">Daftar produk</h2></div><label className="admin-product-filter">Status<select value={filter} onChange={event => setFilter(event.target.value as typeof filter)}><option value="all">Semua</option><option value="visible">Tampil</option><option value="hidden">Disembunyikan</option></select></label></div>
      <label className="admin-product-search">Cari produk atau toko<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Contoh: laptop, Kuranji"/></label>
      {!items && !error && <p role="status">Memuat produk…</p>}
      {results?.length === 0 && <p className="admin-empty">Tidak ada produk yang cocok dengan pencarian ini.</p>}
      {results && <PagedList items={results} label="daftar produk admin" resetKey={query+filter} size={8} className="admin-products-grid">{item => <article className="admin-product-row" key={item.id}>
        <div className="admin-product-art">{item.photo_url?<img src={item.photo_url} alt={'Foto '+item.name} loading="lazy"/>:<span>{categoryNames[item.category] ?? 'Produk'}</span>}</div>
        <div className="admin-product-copy"><div className="admin-product-top"><span className="design-flag">{item.condition === 'used' ? 'Bekas' : 'Baru'}</span><span className={'admin-product-state'+(item.published?' is-visible':'')}>{item.published?'Tampil':'Disembunyikan'}</span></div><h3>{item.name}</h3><p className="muted">{item.shop_name ?? 'Toko tidak tersedia'}{item.shop_city ? ` · ${item.shop_city}` : ''}</p><p><strong>{money(item.price)}</strong><span className="admin-product-stock">{item.stock} stok</span></p>
          <button className="admin-visibility-button" type="button" disabled={busy===item.id} onClick={() => void toggle(item)}>{busy===item.id?'Menyimpan…':item.published?'Sembunyikan produk':'Tampilkan produk'}</button>
          <details className="admin-crud-form"><summary>Edit produk</summary><ProductForm item={item} shops={shops} onSave={event=>void saveProduct(event,item)}/></details>
          <button className="admin-delete-button" disabled={busy===item.id} onClick={()=>void removeProduct(item)}>Hapus produk</button>
        </div>
      </article>}</PagedList>}
    </section>
  </section>
}

function ProductForm({item,shops,onSave}:{item?:AdminProduct;shops:ShopOption[];onSave:(event:FormEvent<HTMLFormElement>)=>void}) {
  return <form onSubmit={onSave}>
    <label>Toko<select name="shop_id" defaultValue={item?.shop_id??shops[0]?.id} required>{shops.map(shop=><option value={shop.id} key={shop.id}>{shop.name} · {shop.city}</option>)}</select></label>
    <label>Nama produk<input name="name" defaultValue={item?.name} minLength={2} maxLength={100} required/></label>
    <label>Kategori<select name="category" defaultValue={item?.category??'phone'}><option value="phone">HP</option><option value="laptop">Laptop</option><option value="phone_accessory">Aksesori HP</option><option value="laptop_accessory">Aksesori laptop</option></select></label>
    <label>Kondisi<select name="condition" defaultValue={item?.condition??'new'}><option value="new">Baru</option><option value="used">Bekas</option></select></label>
    <label>Deskripsi<input name="description" defaultValue={item?.description} minLength={10} maxLength={600} required/></label>
    <label>Harga<input name="price" type="number" min="1" max="100000000" defaultValue={item?.price??1} required/></label>
    <label>Stok<input name="stock" type="number" min="0" max="10000" defaultValue={item?.stock??1} required/></label>
    <label>Garansi (hari)<input name="warranty_days" type="number" min="0" max="730" defaultValue={item?.warranty_days??0} required/></label>
    <ProductPhotoField item={item}/>
    <label>Catatan kondisi<input name="condition_notes" defaultValue={item?.condition_notes??''}/></label>
    <label>Catatan pemeriksaan<input name="inspection_notes" defaultValue={item?.inspection_notes??''}/></label>
    <button className="button" type="submit">Simpan produk</button>
  </form>
}

function ProductPhotoField({item}:{item?:AdminProduct}) {
  const [url,setUrl]=useState(item?.photo_url??'')
  const [preview,setPreview]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  async function select(file?:File) {
    setError('');setPreview('')
    if(!file)return
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('Pilih foto JPG, PNG, atau WebP.');return}
    if(file.size>5*1024*1024){setError('Ukuran foto maksimal 5 MB.');return}
    setPreview(URL.createObjectURL(file));setBusy(true)
    try {setUrl(await uploadPhoto(file))} catch(failure) {setError(failure instanceof Error?failure.message:'Foto belum dapat diunggah.');setUrl(item?.photo_url??'')}
    finally {setBusy(false)}
  }
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview])
  return <div className="admin-photo-field"><label>Foto produk<input type="hidden" name="photo_url" value={url}/><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>void select(event.target.files?.[0])}/></label><small>Disarankan 1200 × 800 px, rasio 3:2. JPG, PNG, atau WebP · maksimal 5 MB.</small>{error&&<small className="error" role="alert">{error}</small>}{busy&&<small role="status">Mengunggah foto…</small>}{(preview||url)&&<img src={preview||url} alt="Pratinjau foto produk" loading="lazy"/>}</div>
}
