import { PagedList } from '../components/PagedList'
import { useEffect, useState } from 'react'
import { api, ApiError, money } from '../api'
import { readCart, saveCart } from '../cart'
import { ActionForm, field } from '../components/ActionForm'
import { categories, type Product } from './Products'

const productUrl = (id:string) => '/products/'+encodeURIComponent(id)
const detailUrl = (id:string) => '?halaman=detail-produk&id='+encodeURIComponent(id)
export function ProductDetail() {
  const id = new URLSearchParams(location.search).get('id') ?? ''
  const [item,setItem] = useState<Product | null>(null)
  const [error,setError] = useState('')
  const [added,setAdded] = useState(false)
  useEffect(() => {
    let active = true
    if (!id) return
    void api<Product>(productUrl(id)).then(product => { if (active) setItem(product) },failure => {
      if (active) setError(failure instanceof ApiError && failure.status === 404 ? 'Produk sudah tidak tersedia.' : 'Detail produk belum dapat dimuat.')
    })
    return () => { active=false }
  },[id])
  return <section className="wrap page">
    <a className="back" href="?halaman=produk">← Katalog produk</a>
    {!item ? <><h1>Detail produk</h1><p role={error || !id ? 'alert' : 'status'}>{error || (id ? 'Memuat produk…' : 'Pilih produk dari katalog.')}</p></>
      : <div className="purchase-detail grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,.85fr)] lg:gap-12">
        {item.photo_url ? <img className="purchase-photo h-[clamp(190px,38vw,385px)] w-full max-w-[560px] rounded-sm object-contain" src={item.photo_url} alt={item.name} referrerPolicy="no-referrer"/>
          : <div className="purchase-photo shop-photo-empty h-[clamp(190px,38vw,385px)] w-full max-w-[560px] rounded-sm">Foto produk belum tersedia</div>}
        <div>
          <p className="muted">{categories[item.category]} · {item.condition === 'used' ? 'Bekas' : 'Baru'}{item.demo ? ' · Demo' : ''}</p>
          <h1>{item.name}</h1>
          <p>{item.shop_name} · {item.city}</p>
          <p className="purchase-price">{money(item.price)}</p>
          <p>{item.description}</p>
          <section className="design-summary" aria-label="Kondisi dan garansi produk">
            <h2 className="text-xl">Kondisi dan garansi</h2>
            <p>{item.condition_notes ?? (item.condition === 'new' ? 'Unit baru' : 'Unit bekas')}</p>
            {item.condition === 'used' && <p><strong>Hasil pemeriksaan:</strong> {item.inspection_notes || 'Belum dicatat'}</p>}
            {item.warranty_days > 0 && <p><strong>Garansi toko {item.warranty_days} hari</strong></p>}
            <p>Stok tersedia: {item.stock}</p>
          </section>
          {item.stock > 0 ? <ActionForm className="purchase-quantity" label="Tambah ke keranjang" onSend={async form => {
            const quantity = Number(field(form,'quantity'))
            const latest = await api<Product>(productUrl(item.id))
            const cart = readCart()
            const previous = cart.find(row => row.id === item.id)
            const combined = (previous?.quantity ?? 0) + quantity
            if (!Number.isInteger(quantity) || quantity < 1 || combined > latest.stock) throw new Error('Jumlah di keranjang akan melebihi stok saat ini.')
            saveCart([...cart.filter(row => row.id !== item.id),{ id:item.id,quantity:combined }])
            setAdded(true)
          }}>
            <label>Jumlah<input name="quantity" type="number" min={1} max={item.stock} defaultValue={1} required/></label>
          </ActionForm> : <p className="status">Stok habis</p>}
          {added && <p role="status">Produk ditambahkan ke keranjang.</p>}
          <a className="text-action" href="?halaman=keranjang">Buka keranjang →</a>
        </div>
      </div>}
  </section>
}
type CartRow = { id:string; quantity:number; product:Product|null }
export function Cart() {
  const [rows,setRows] = useState<CartRow[] | null>(null)
  const [error,setError] = useState('')
  const [retry,setRetry] = useState(0)
  useEffect(() => {
    let active = true
    void Promise.all(readCart().map(async row => {
      try { return { ...row,product:await api<Product>(productUrl(row.id)) } }
      catch (failure) {
        if (failure instanceof ApiError && failure.status === 404) return { ...row,product:null }
        throw failure
      }
    })).then(result => { if (active) setRows(result) },() => { if (active) setError('Harga dan stok belum dapat diperiksa. Coba lagi.') })
    return () => { active=false }
  },[retry])
  function persist(items:CartRow[]) {
    saveCart(items.map(({ id,quantity }) => ({ id,quantity })))
    setRows(items)
  }
  const total = rows?.reduce((subtotal,row) =>
    subtotal+(row.product && row.quantity <= row.product.stock ? row.quantity*row.product.price : 0),0) ?? 0
  return <section className="wrap page">
    <a className="back" href="?halaman=produk">← Katalog produk</a>
    <h1>Keranjang</h1>
    {error ? <><p role="alert">{error}</p><button className="button" onClick={() => { setError('');setRetry(value => value+1) }}>Muat ulang</button></>
      : !rows ? <p role="status">Memeriksa harga dan stok…</p>
        : !rows.length ? <div className="panel"><p>Keranjang masih kosong.</p><a className="button" href="?halaman=produk">Lihat produk</a></div>
        : <div className="purchase-detail grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,.85fr)] lg:gap-12">
          <div><PagedList items={rows} label="isi keranjang">{row => <article className="panel cart-line" key={row.id+':'+row.quantity}>
            {row.product && row.product.photo_url && <img className="shop-photo" src={row.product.photo_url} alt="" referrerPolicy="no-referrer"/>}
            <div>
              <h2>{row.product ? <a href={detailUrl(row.id)}>{row.product.name}</a> : 'Produk tidak tersedia'}</h2>
              {row.product && <p>{row.product.shop_name} · {money(row.product.price)}</p>}
              {row.product && row.product.stock > 0 && <ActionForm label="Simpan jumlah" onSend={async form => {
                const quantity = Number(field(form,'quantity'))
                if (!Number.isInteger(quantity) || quantity < 1 || quantity > row.product!.stock) throw new Error('Jumlah melebihi stok.')
                persist(rows.map(item => item.id === row.id ? { ...item,quantity } : item))
              }}>
                <label>Jumlah<input name="quantity" type="number" min={1} max={row.product.stock} defaultValue={Math.min(row.quantity,row.product.stock)} required/></label>
              </ActionForm>}
              {row.product && (row.product.stock === 0 || row.quantity > row.product.stock) &&
                <p className="muted">{row.product.stock ? 'Stok berkurang. Simpan jumlah baru.' : 'Stok habis.'}</p>}
              <button className="link" onClick={() => {
                try { persist(rows.filter(item => item.id !== row.id)) }
                catch (failure) { setError(failure instanceof Error ? failure.message : 'Keranjang belum dapat disimpan.') }
              }}>Hapus produk</button>
            </div>
          </article>}</PagedList></div>
          <aside className="panel"><h2>Ringkasan</h2><p>Subtotal produk tersedia</p><p className="purchase-price">{money(total)}</p>
            <p className="muted">Harga dan stok dapat berubah sebelum pemesanan.</p>
          </aside>
        </div>}
  </section>
}

