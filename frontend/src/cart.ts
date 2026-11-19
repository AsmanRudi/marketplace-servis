export type CartItem = { id:string; quantity:number }
const key = 'meja-servis-cart-v1'
export function readCart(): CartItem[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    if (!Array.isArray(data)) return []
    const valid = data.filter((item): item is CartItem => item && typeof item.id === 'string' &&
      /^[a-f0-9-]{36}$/.test(item.id) && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 10000)
    return [...new Map(valid.map(item => [item.id,item])).values()].slice(0,30)
  } catch { return [] }
}
export function saveCart(items: CartItem[]) {
  if (items.length > 30) throw new Error('Keranjang memuat maksimal 30 produk berbeda.')
  try { localStorage.setItem(key,JSON.stringify(items)) }
  catch { throw new Error('Keranjang belum dapat disimpan di browser.') }
}

