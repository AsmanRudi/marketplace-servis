import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

const base = process.env.TEST_API_URL ?? 'http://127.0.0.1:3001/api'
const suffix = randomBytes(5).toString('hex')
const demoPassword = process.env.DEMO_PASSWORD
assert(demoPassword, 'DEMO_PASSWORD diperlukan untuk database uji dengan data demo.')

async function request(path, { cookie, body, status = 200 } = {}) {
  const res = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json()
  assert.equal(res.status, status, path + ' ' + JSON.stringify(data))
  return { data, cookie: res.headers.get('set-cookie')?.split(';')[0] }
}
const register = (name, prefix) => request('/auth/register', { body: { name, email: prefix + suffix + '@test.example', password: 'test-only-phrase-123' }, status: 201 })
const login = email => request('/auth/login', { body: { email, password: demoPassword }, status: 201 })
assert.equal((await request('/auth/me')).data,null)
await request('/orders',{ status:401 })
await request('/admin/overview',{ status:401 })
const manager = (await login('manager1@demo.example')).cookie
const otherManager = (await login('manager2@demo.example')).cookie
const tech = (await login('technician1@demo.example')).cookie
const { cookie: customer } = await register('Pelanggan Uji','customer')
const { cookie: stranger } = await register('Akun Uji Asing','stranger')
const { data: application } = await request('/shops',{ cookie:stranger, body:{
  name:'Toko Baru Uji ' + suffix, city:'Semarang', district:'Banyumanik',
  dropoff_address:'Alamat pengujian sintetis', description:'Toko untuk pengujian verifikasi.',
}, status:201 })
await request('/shops/' + application.id + '/verify',{ cookie:stranger, body:{}, status:403 })
await request('/admin/overview',{ cookie:stranger,status:403 })
const { data: shops } = await request('/shops')
const shop = shops.find(s => s.name === 'Meja Reparasi Cikini')
const other = shops.find(s => s.name === 'Bengkel Laptop Dago')
assert(shop && other)
assert.equal((await request('/auth/me',{ cookie:manager })).data.memberships[0].role,'manager')
assert(!shops.some(s => s.id === application.id))
const product = { name:'Laptop Uji Bekas '+suffix,category:'laptop',condition:'used',description:'Unit untuk pengujian katalog.',price:2500000,stock:1,warranty_days:30,photo_url:null,condition_notes:'Kondisi baik, lengkap dengan pengisi daya.' }
const productRoute = '/products/shops/'+shop.id
await request(productRoute,{ cookie:otherManager,body:product,status:403 })
await request(productRoute,{ cookie:manager,body:{...product,stock:2},status:400 })
const { data: addedProduct } = await request(productRoute,{ cookie:manager,body:product,status:201 })
assert((await request('/products')).data.some(item => item.id === addedProduct.id))
assert.equal((await request('/products/'+addedProduct.id)).data.stock,1)
await request(productRoute+'/'+addedProduct.id,{ cookie:manager,body:{stock:0,published:false},status:201 })
assert(!(await request('/products')).data.some(item => item.id === addedProduct.id))
await request('/products/'+addedProduct.id,{ status:404 })
const booking = { service_id: shop.services[0].id, preferred_id: shop.technicians[0].id, device_model:'Ponsel Uji', complaint:'Baterai cepat habis' }

await request('/orders',{ body:booking, status:401 })
await request('/orders',{ cookie:customer, body:{ ...booking, preferred_id:other.technicians[0].id }, status:404 })
const { data: order } = await request('/orders',{ cookie:customer, body:booking, status:201 })
const path = '/orders/' + order.id
const post = (endpoint, cookie, body, status = 201) => request(path + '/' + endpoint,{ cookie, body, status })
const set = (cookie, status, condition) => post('status',cookie,{ status, condition })
await request(path,{ cookie:otherManager, status:404 })
await request(path,{ cookie:stranger, status:404 })
await request(path,{ cookie:tech, status:404 })
await post('status',otherManager,{ status:'accepted' },404)
await post('assign',manager,{ technician_id:other.technicians[0].id },404)
await post('assign',manager,{ technician_id:shop.technicians[0].id })
await request(path,{ cookie:tech })
await set(manager,'accepted')
await post('status',manager,{ status:'received' },409)
await set(manager,'received','Unit dan casing diterima')
await set(tech,'diagnosis')
await post('status',tech,{ status:'repairing' },409)
const quote = { diagnosis:'Baterai menurun kapasitasnya', labor:50000, parts:100000, duration:'Satu hari' }
await post('quotes',tech,quote)
const { data: first } = await request(path,{ cookie:customer })
await post('quotes',tech,{ ...quote, parts:120000 })
await post('decision',customer,{ quote_id:first.quotes[0].id, approve:true },409)
const { data: revised } = await request(path,{ cookie:customer })
const pending = revised.quotes.find(q => q.status === 'pending')
await post('decision',manager,{ quote_id:pending.id, approve:true },403)
await post('decision',customer,{ quote_id:pending.id, approve:true })
await set(tech,'repairing')
const payment = { method:'bank_transfer', amount:170000 }
await post('payment',manager,payment,409)
await set(tech,'ready')
await post('status',manager,{ status:'completed' },409)
await post('payment',customer,payment,403)
await post('payment',tech,payment,403)
await post('payment',otherManager,payment,404)
await post('payment',manager,{ ...payment, amount:150000 },409)
await post('payment',manager,{ ...payment, method:'no_charge' },409)
const submitPayment = () => fetch(base + path + '/payment', {
  method:'POST', headers:{ Cookie:manager, 'Content-Type':'application/json' }, body:JSON.stringify(payment),
})
const receipts = await Promise.all([submitPayment(),submitPayment()])
assert.deepEqual(receipts.map(res => res.status).sort(),[201,409])
await set(manager,'completed')
await post('review',customer,{ rating:5, comment:'Servis selesai.' })
await post('review',customer,{ rating:4, comment:'Ulasan kedua.' },409)
const { data: done } = await request(path,{ cookie:customer })
assert.equal(done.status,'completed')
assert(done.completed_at)
assert.equal(done.warranty_days,30)
assert(done.dropoff_address)
assert.equal(done.events.at(-1).status,'completed')
assert.equal(done.review.rating,5)
assert.equal(done.payment.amount,170000)
assert.equal(done.payment.quote_id,pending.id)
assert.equal(done.payment.method,'bank_transfer')
const newCase = { kind:'warranty',message:'Perangkat kembali mengalami gejala yang sama.' }
await request('/cases/'+order.id,{ cookie:stranger,body:newCase,status:404 })
await request('/cases/'+order.id,{ cookie:customer,body:newCase,status:201 })
await request('/cases/'+order.id,{ cookie:customer,body:newCase,status:409 })
await request('/cases/'+order.id,{ cookie:otherManager,status:404 })
await request('/cases/'+order.id,{ cookie:tech,status:404 })
await request('/cases/'+order.id+'/reply',{ cookie:customer,body:{ status:'resolved',message:'Tutup klaim' },status:403 })
await request('/cases/'+order.id+'/reply',{ cookie:manager,body:{ status:'in_review',message:'Kami akan memeriksa perangkat.' },status:201 })
const resolver = process.env.ADMIN_EMAIL ? (await request('/auth/login',{
  body:{ email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD },status:201,
})).cookie : manager
assert((await request('/cases',{ cookie:resolver })).data.some(item => item.ticket_id === order.id))
if (process.env.ADMIN_EMAIL) {
  const { data: dashboard }=await request('/admin/overview',{ cookie:resolver })
  const summary=dashboard.cases.recent.find(item => item.ticket_id === order.id)
  assert(summary && summary.status === 'in_review')
  assert(!('messages' in summary) && !('customer_id' in summary))
}
await request('/cases/'+order.id+'/reply',{ cookie:resolver,body:{ status:'resolved',message:'Kasus telah ditangani.' },status:201 })
const caseResult = (await request('/cases/'+order.id,{ cookie:customer })).data.case
assert.equal(caseResult.status,'resolved')
assert.equal(caseResult.messages.length,3)
await request('/cases/'+order.id+'/reply',{ cookie:customer,body:{ message:'Tanggapan lain' },status:409 })
const { data: inbox } = await request('/notifications',{ cookie:customer })
const notification = inbox.find(item => item.ticket_id === order.id && item.status === 'ready')
assert(notification && !notification.read)
assert(inbox.some(item => item.ticket_id === order.id && item.status === 'quoted'))
const { data: strangerInbox } = await request('/notifications',{ cookie:stranger })
assert(!strangerInbox.some(item => item.ticket_id === order.id))
const seen = { ticket_id:order.id,event:notification.event }
await request('/notifications/read',{ cookie:stranger,body:seen,status:404 })
await request('/notifications/read',{ cookie:customer,body:seen,status:201 })
await request('/notifications/read',{ cookie:customer,body:seen,status:201 })
const { data: readInbox } = await request('/notifications',{ cookie:customer })
assert(readInbox.some(item => item.ticket_id === order.id && item.event === notification.event && item.read))
let freeBooking=booking
let freeManager=manager
if (process.env.ADMIN_EMAIL) {
  const { data: before }=await request('/admin/overview',{ cookie:resolver })
  assert(before.applications.some(item => item.id === application.id))
  assert(before.tickets.total >= 1)
  await request('/shops/'+application.id+'/verify',{ cookie:resolver,body:{},status:201 })
  const { data: after }=await request('/admin/overview',{ cookie:resolver })
  assert(!after.applications.some(item => item.id === application.id))
  assert.equal(after.shops.verified,before.shops.verified+1)
  assert.equal(after.shops.pending,before.shops.pending-1)
  const added=await request('/shops/'+application.id+'/services',{ cookie:stranger,body:{
    name:'Diagnosis pengujian',device:'HP',starting_price:0,warranty_days:0,
  },status:201 })
  freeBooking={ ...booking,service_id:added.data.id,preferred_id:null }
  freeManager=stranger
}
const { data: freeOrder } = await request('/orders',{ cookie:customer, body:freeBooking, status:201 })
const freePath = '/orders/' + freeOrder.id
const freePost = (action, cookie, body, status = 201) => request(freePath + '/' + action,{ cookie,body,status })
await freePost('status',freeManager,{ status:'accepted' })
await freePost('status',freeManager,{ status:'received', condition:'Unit diterima' })
await freePost('status',freeManager,{ status:'diagnosis' })
await freePost('quotes',freeManager,{ ...quote, labor:0, parts:0 })
const { data: freeDetail } = await request(freePath,{ cookie:customer })
await freePost('decision',customer,{ quote_id:freeDetail.quotes[0].id, approve:true })
await freePost('status',freeManager,{ status:'repairing' })
await freePost('status',freeManager,{ status:'ready' })
await freePost('payment',freeManager,{ method:'cash', amount:0 },409)
await freePost('payment',freeManager,{ method:'no_charge', amount:0 })
await freePost('status',freeManager,{ status:'completed' })
const { data: freeDone } = await request(freePath,{ cookie:customer })
assert.equal(freeDone.payment.amount,0)
assert.equal(freeDone.payment.method,'no_charge')
if (process.env.ADMIN_EMAIL) {
  const comment='Ulasan publik pengujian '+suffix
  await freePost('review',customer,{ rating:5,comment })
  assert(!(await request('/orders/reviews')).data.some(item => item.comment === comment))
  await freePost('review/visibility',freeManager,{ public:true },404)
  await freePost('review/visibility',customer,{ public:true })
  const publicReview=(await request('/orders/reviews')).data.find(item => item.comment === comment)
  assert(publicReview)
  assert.deepEqual(Object.keys(publicReview).sort(),['city','comment','device','rating','shop_name'])
  await freePost('review/visibility',customer,{ public:false })
  assert(!(await request('/orders/reviews')).data.some(item => item.comment === comment))
}
if (process.env.TEST_MIDTRANS_STATE) {
  const { data: onlineOrder } = await request('/orders',{ cookie:customer, body:booking, status:201 })
  const onlinePath = '/orders/' + onlineOrder.id
  const onlinePost = (action, cookie, body, status = 201) => request(onlinePath + '/' + action,{ cookie,body,status })
  await onlinePost('status',manager,{ status:'accepted' })
  await onlinePost('status',manager,{ status:'received', condition:'Unit diterima' })
  await onlinePost('status',manager,{ status:'diagnosis' })
  await onlinePost('quotes',manager,quote)
  const { data: invoice } = await request(onlinePath,{ cookie:customer })
  await onlinePost('decision',customer,{ quote_id:invoice.quotes[0].id, approve:true })
  await onlinePost('status',manager,{ status:'repairing' })
  await onlinePost('status',manager,{ status:'ready' })
  await onlinePost('checkout',manager,{},403)
  const first = await onlinePost('checkout',customer,{})
  const second = await onlinePost('checkout',customer,{})
  assert.equal(first.data.redirect_url,second.data.redirect_url)
  await onlinePost('payment',manager,{ method:'cash',amount:150000 },409)
  const webhook = { order_id:'MS-' + onlineOrder.id, status_code:'200', gross_amount:'150000.00' }
  const signature = createHash('sha512').update(webhook.order_id + webhook.status_code + webhook.gross_amount + process.env.MIDTRANS_SANDBOX_SERVER_KEY).digest('hex')
  const notify = (signature_key, status = 200) => request('/orders/midtrans/webhook',{ body:{ ...webhook,signature_key },status })
  await notify('0'.repeat(128),403)
  const simulate = (status,offset = 0) => writeFile(process.env.TEST_MIDTRANS_STATE, JSON.stringify({ status,offset }))
  await simulate('pending')
  await onlinePost('checkout/status',customer,{})
  assert.equal((await request(onlinePath,{ cookie:customer })).data.payment,null)
  await simulate('settlement',1)
  await notify(signature,502)
  await simulate('settlement')
  await notify(signature)
  await notify(signature)
  const receipt = (await request(onlinePath,{ cookie:customer })).data.payment
  assert.equal(receipt.method,'midtrans_sandbox')
  assert.equal(receipt.amount,150000)
  await simulate('refund')
  await notify(signature)
  assert.equal((await request(onlinePath,{ cookie:customer })).data.checkout_status,'review_required')
  await onlinePost('status',manager,{ status:'completed' },409)
  console.log('Lulus fixture Midtrans: pembatasan akses, pending, tanda tangan, nominal, notifikasi ulang, refund.')
}
console.log('Lulus: booking, penugasan, batas toko, revisi dan persetujuan, pengerjaan, pembayaran tunggal sesuai tagihan, servis bebas biaya, serah terima, satu ulasan, kotak notifikasi privat, klaim garansi privat.')

