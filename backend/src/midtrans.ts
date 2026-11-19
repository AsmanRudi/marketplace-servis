import { badGateway, HttpError } from './http'
import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

export const midtransEnabled = () => Boolean(process.env.MIDTRANS_SANDBOX_SERVER_KEY)
function key() {
  const value = process.env.MIDTRANS_SANDBOX_SERVER_KEY
  if (!value) throw new HttpError(503,'Checkout sandbox belum dikonfigurasi.')
  return value
}
async function request(url: string, body?: object) {
  const authorization = 'Basic ' + Buffer.from(key() + ':').toString('base64')
  let response: Response
  try {
    response = await fetch(url,{
      method: body ? 'POST' : 'GET',
      headers: { Accept:'application/json', 'Content-Type':'application/json', Authorization:authorization },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(7000), redirect:'error',
    })
  } catch { throw badGateway('Midtrans sandbox belum dapat dihubungi. Coba lagi.') }
  if (!body && response.status === 404) return null
  if (!response.ok) throw badGateway('Permintaan ke Midtrans sandbox gagal. Periksa status sebelum mencoba kembali.')
  return response.json().catch(() => { throw badGateway('Respons Midtrans sandbox tidak valid.') })
}

const snap = z.object({ redirect_url:z.url() })
export async function createCheckout(order: string, amount: number) {
  const result = snap.safeParse(await request('https://app.sandbox.midtrans.com/snap/v1/transactions',{
    transaction_details:{ order_id:order, gross_amount:amount },
  }))
  if (!result.success) throw badGateway('Tautan Midtrans sandbox tidak tersedia.')
  const link = new URL(result.data.redirect_url)
  if (link.origin !== 'https://app.sandbox.midtrans.com' || link.username || link.password) {
    throw badGateway('Tautan Midtrans sandbox tidak valid.')
  }
  return link.href
}

const status = z.object({
  order_id:z.string(), gross_amount:z.string(), status_code:z.string(), transaction_status:z.string(),
  fraud_status:z.string().optional(), currency:z.literal('IDR').optional(),
})
export async function fetchCheckoutStatus(order: string) {
  const data = await request('https://api.sandbox.midtrans.com/v2/' + encodeURIComponent(order) + '/status')
  if (data === null) return null
  if (typeof data === 'object' && 'status_code' in data && data.status_code === '404') return null
  const result = status.safeParse(data)
  if (!result.success) throw badGateway('Status dari Midtrans sandbox tidak valid.')
  return result.data
}
export const notification = z.object({
  order_id:z.string().regex(/^MS-[0-9a-f-]{36}$/), status_code:z.string().regex(/^\d{3}$/),
  gross_amount:z.string().regex(/^\d{1,10}(?:\.\d{2})?$/), signature_key:z.string().regex(/^[a-fA-F0-9]{128}$/),
})
export function validNotification(body: z.infer<typeof notification>) {
  const expected = createHash('sha512').update(body.order_id + body.status_code + body.gross_amount + key()).digest()
  return timingSafeEqual(expected,Buffer.from(body.signature_key,'hex'))
}

