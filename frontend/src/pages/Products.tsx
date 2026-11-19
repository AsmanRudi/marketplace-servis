import { PagedList } from '../components/PagedList'
import { useEffect, useState } from 'react'
import { api, money } from '../api'
import { ActionForm, field } from '../components/ActionForm'

export const categories = { phone:'HP', laptop:'Laptop', phone_accessory:'Aksesori HP', laptop_accessory:'Aksesori laptop' }
type Category = keyof typeof categories
export type Product = {
  id:string; name:string; category:Category; condition:'new'|'used'; description:string;
  price:number; stock:number; warranty_days:number; photo_url:string|null; condition_notes:string|null; inspection_notes?:string|null;
  shop_name?:string; city?:string; demo?:boolean; published?:boolean;
}
function CategoryOptions() {
  return <>{Object.entries(categories).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</>
}
export function Products() {
  const [items,setItems] = useState<Product[]|null>(null)
  const [error,setError] = useState(false)
  const [attempt,setAttempt] = useState(0)
  const [category,setCategory] = useState('')
  const [condition,setCondition] = useState('')
  useEffect(() => {
    let active = true
    void api<Product[]>('/products').then(rows => { if (active) setItems(rows) },() => { if (active) setError(true) })
    return () => { active=false }
  },[attempt])
  const results = items?.filter(item => (!category || item.category === category) && (!condition || item.condition === condition))
  return <section className="wrap page catalog-page">
    <h1>Katalog produk</h1>
    <a className="text-action" href="?halaman=keranjang">Buka keranjang →</a>
    <div className="filters">
      <label>Kategori<select value={category} onChange={event => setCategory(event.target.value)}><option value="">Semua kategori</option><CategoryOptions/></select></label>
      <label>Kondisi<select value={condition} onChange={event => setCondition(event.target.value)}><option value="">Semua kondisi</option><option value="new">Baru</option><option value="used">Bekas</option></select></label>
    </div>
    {error ? <div className="panel"><p role="alert">Katalog belum dapat dimuat.</p><button className="button" onClick={() => { setError(false);setAttempt(value => value+1) }}>Muat ulang</button></div>
      : !results ? <p role="status">Memuat produk…</p> : !results.length ? <p>Belum ada produk untuk pilihan ini.</p>
      : <PagedList items={results} label="produk" size={8} resetKey={category+condition} className="product-grid grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{item => <article className="panel" key={item.id}>
        {item.photo_url ? <img className="product-card-photo mb-3.5 block h-[clamp(135px,18vw,175px)] w-full rounded-sm object-contain" src={item.photo_url} alt={item.name} loading="lazy" referrerPolicy="no-referrer"/> : <div className="product-card-photo product-card-empty mb-3.5" aria-hidden="true">Foto belum tersedia</div>}
        <p className="product-category muted">{categories[item.category]} · {item.condition === 'new' ? 'Baru' : 'Bekas'}{item.demo ? ' · Demo' : ''}</p>
        <h2>{item.name}</h2>
        <p className="product-shop muted">{item.shop_name}{item.city ? ` · ${item.city}` : ''}</p>
        <p className="product-price"><strong>{money(item.price)}</strong><span>{item.stock ? 'Stok tersedia' : 'Stok habis'}</span></p>
        <p className="product-description">{item.description}</p>
        {item.condition === 'used' && <p className="product-inspected">✓ Kondisi dan fungsi sudah dicatat</p>}
        <a className="button" href={'?halaman=detail-produk&id='+item.id}>Lihat produk</a>
      </article>}</PagedList>}
  </section>
}
export function ShopProducts({ shopId }: { shopId:string }) {
  const [items,setItems] = useState<Product[]|null>(null)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const route = '/products/shops/'+shopId
  useEffect(() => {
    let active = true
    void api<Product[]>(route).then(rows => { if (active) setItems(rows) },() => { if (active) setError('Produk belum dapat dimuat.') })
    return () => { active=false }
  },[route])
  return <details className="product-manager">
    <summary>Kelola produk</summary>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {items && <PagedList items={items} label="produk toko">{item => <ActionForm key={item.id+':'+item.stock+':'+item.published} label="Simpan stok" onSend={async form => {
      await api(route+'/'+item.id,{ stock:Number(field(form,'stock')),published:form.has('published') })
      setItems(await api<Product[]>(route))
      setNotice('Stok dan visibilitas tersimpan.')
    }}>
      <h4>{item.name}</h4>
      <label>Stok<input type="number" name="stock" min={0} max={item.condition === 'used' ? 1 : 10000} defaultValue={item.stock} required/></label>
      <label className="product-check"><input type="checkbox" name="published" defaultChecked={item.published}/> Tampilkan di katalog</label>
    </ActionForm>}</PagedList>}
    <ActionForm label="Tambah produk" onSend={async (form,event) => {
      const element=event.currentTarget
      await api(route,{ name:field(form,'name'),category:field(form,'category'),condition:field(form,'condition'),
        description:field(form,'description'),price:Number(field(form,'price')),stock:Number(field(form,'stock')),
        warranty_days:Number(field(form,'warranty_days')),condition_notes:field(form,'condition_notes').trim() || null,
        inspection_notes:field(form,'inspection_notes').trim() || null,
        photo_url:field(form,'photo_url').trim() || null })
      setItems(await api<Product[]>(route))
      setNotice('Produk ditambahkan.')
      element.reset()
    }}>
      <h3>Produk baru di katalog</h3>
      <label>Nama produk<input name="name" required minLength={2} maxLength={100}/></label>
      <label>Kategori<select name="category"><CategoryOptions/></select></label>
      <label>Kondisi<select name="condition"><option value="new">Baru</option><option value="used">Bekas</option></select></label>
      <label>Deskripsi<textarea name="description" rows={3} minLength={10} maxLength={600} required/></label>
      <label>Kondisi dan kelengkapan unit bekas<textarea name="condition_notes" rows={2} maxLength={500} placeholder="Contoh: ada goresan ringan, lengkap dengan charger"/></label>
      <label>Hasil pemeriksaan fungsi unit bekas<textarea name="inspection_notes" rows={2} maxLength={500} placeholder="Contoh: layar, kamera, speaker, dan pengisian daya berfungsi"/></label>
      <label>URL foto aktual (HTTPS; wajib untuk unit bekas)<input name="photo_url" type="url" maxLength={1500}/></label>
      <label>Harga (Rp)<input name="price" type="number" min={1} max={100000000} required/></label>
      <label>Stok<input name="stock" type="number" min={0} max={10000} required/></label>
      <label>Garansi (hari)<input name="warranty_days" type="number" min={0} max={730} defaultValue={0} required/></label>
    </ActionForm>
  </details>
}

