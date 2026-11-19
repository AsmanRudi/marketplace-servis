import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { actor } from './auth'
import { shops, tickets } from './db'
import { conflict, forbidden, id, missing, parse, words } from './http'
import { midtransEnabled } from './midtrans'
import { checkoutRoutes } from './checkout'
import { access, approvedBill, changeTicket, event, loadTicket, onlineBlocks, receipt, roleFor, techSteps, ticketView, transitions } from './ticket-state'

export const orderRoutes = Router()
orderRoutes.use(checkoutRoutes)
orderRoutes.get('/',async (req,res) => {
  const user = await actor(req)
  const memberships = await shops.find({ 'members.user_id':user.id }).toArray()
  const managed = memberships.filter(shop => roleFor(shop,user.id) === 'manager').map(shop => shop._id)
  const assigned = memberships.filter(shop => roleFor(shop,user.id) === 'technician').map(shop => shop._id)
  const rows = await tickets.find({ $or:[
    { customer_id:user.id },{ shop_id:{ $in:managed } },{ shop_id:{ $in:assigned },technician_id:user.id },
  ] }).sort({ created_at:-1 }).toArray()
  const stores = await shops.find({ _id:{ $in:[...new Set(rows.map(ticket => ticket.shop_id))] } }).toArray()
  const byId = new Map(stores.map(shop => [shop._id,shop]))
  res.json(rows.flatMap(ticket => {
    const shop = byId.get(ticket.shop_id)
    return shop ? [ticketView(ticket,shop,user.id)] : []
  }))
})
orderRoutes.get('/reviews',async (_req,res) => {
  const rows = await tickets.aggregate([
    { $match:{ status:'completed','review.public':true } },
    { $sort:{ 'review.created_at':-1,_id:1 } },
    { $lookup:{ from:'shops',localField:'shop_id',foreignField:'_id',as:'shop' } },
    { $unwind:'$shop' },
    { $match:{ 'shop.verified':true,'shop.demo':{ $ne:true } } },
    { $limit:4 },
    { $project:{ _id:0,shop_name:'$shop.name',city:'$shop.city',device:1,rating:'$review.rating',comment:'$review.comment' } },
  ]).toArray()
  res.json(rows)
})
orderRoutes.get('/:order',async (req,res) => {
  const user = await actor(req)
  const ticket = await loadTicket(parse(id,req.params.order))
  const { shop } = await access(ticket,user.id)
  const payment = ticket.payment && {
    id:ticket.payment.id,quote_id:ticket.payment.quote_id,amount:ticket.payment.amount,
    method:ticket.payment.method,recorded_at:ticket.payment.recorded_at,
  }
  res.json({ ...ticketView(ticket,shop,user.id),quotes:ticket.quotes,events:ticket.events.map(({ status,note,created_at }) => ({ status,note,created_at })),
    review:ticket.review,payment,has_case:Boolean(ticket.service_case),checkout_status:ticket.checkout?.status ?? null,online_enabled:midtransEnabled() })
})
orderRoutes.post('/',async (req,res) => {
  const user = await actor(req)
  const input = parse(z.object({ service_id:id,preferred_id:id.nullable(),device_model:words(2,120),complaint:words(5,1500) }),req.body)
  const shop = await shops.findOne({ verified:true,'services.id':input.service_id })
  const service = shop?.services.find(item => item.id === input.service_id)
  if (!shop || !service || (input.preferred_id && roleFor(shop,input.preferred_id) !== 'technician')) {
    throw missing('Layanan atau teknisi tidak tersedia.')
  }
  const order = randomUUID()
  const created = new Date()
  await tickets.insertOne({
    _id:order,revision:0,...input,customer_id:user.id,shop_id:shop._id,shop_name:shop.name,
    service_name:service.name,device:service.device,warranty_days:service.warranty_days,technician_id:null,technician_name:null,
    condition:null,status:'submitted',created_at:created,completed_at:null,quotes:[],
    events:[{ actor_id:user.id,status:'submitted',note:null,created_at:created }],review:null,payment:null,checkout:null,
  })
  res.status(201).json({ id:order })
})
orderRoutes.post('/:order/assign',async (req,res) => {
  const user = await actor(req)
  const order = parse(id,req.params.order)
  const { technician_id } = parse(z.object({ technician_id:id }),req.body)
  await changeTicket(order,async ticket => {
    const { shop,role } = await access(ticket,user.id)
    if (role !== 'manager') throw forbidden()
    if (['completed','cancelled'].includes(ticket.status)) throw conflict('Tiket sudah ditutup.')
    const tech = shop.members.find(member => member.user_id === technician_id && member.role === 'technician')
    if (!tech) throw missing('Teknisi tidak terdaftar di toko ini.')
    ticket.technician_id = technician_id
    ticket.technician_name = tech.name
  })
  res.status(201).json({ id:order })
})
orderRoutes.post('/:order/status',async (req,res) => {
  const user = await actor(req)
  const order = parse(id,req.params.order)
  const input = parse(z.object({ status:words(1,32),condition:words(3,500).optional() }),req.body)
  await changeTicket(order,async ticket => {
    const { role,assigned } = await access(ticket,user.id)
    const cancel = ticket.customer_id === user.id && ticket.status === 'submitted' && input.status === 'cancelled'
    if (!cancel && role !== 'manager' && !(assigned && techSteps.includes(input.status))) throw forbidden()
    if (!transitions[ticket.status]?.includes(input.status)) throw conflict('Perubahan status ini tidak tersedia.')
    if (input.status === 'received') {
      if (!input.condition) throw conflict('Isi kondisi dan kelengkapan perangkat.')
      ticket.condition = input.condition
    }
    if (input.status === 'completed') {
      if (onlineBlocks(ticket)) throw conflict('Status checkout masih perlu dikonfirmasi.')
      if (!ticket.payment) throw conflict('Catat pembayaran sebelum menyelesaikan serah terima.')
      ticket.completed_at = new Date()
    }
    event(ticket,user.id,input.status)
  })
  res.status(201).json({ ok:true })
})
orderRoutes.post('/:order/quotes',async (req,res) => {
  const user = await actor(req)
  const order = parse(id,req.params.order)
  const input = parse(z.object({ diagnosis:words(3,1000),labor:z.number().int().min(0).max(100_000_000),
    parts:z.number().int().min(0).max(100_000_000),duration:words(2,100) }),req.body)
  await changeTicket(order,async ticket => {
    const { role,assigned } = await access(ticket,user.id)
    if (role !== 'manager' && !assigned) throw forbidden()
    if (!['diagnosis','quoted','approved','repairing','parts'].includes(ticket.status)) throw conflict('Penawaran tidak dapat dibuat di status ini.')
    if (ticket.quotes.length >= 100) throw conflict('Jumlah revisi penawaran mencapai batas.')
    const active = ticket.quotes.find(quote => quote.status === 'pending')
    if (active) active.status = 'superseded'
    ticket.quotes.unshift({ id:randomUUID(),...input,status:'pending',created_at:new Date() })
    event(ticket,user.id,'quoted')
  })
  res.status(201).json({ ok:true })
})
orderRoutes.post('/:order/decision',async (req,res) => {
  const user = await actor(req)
  const order = parse(id,req.params.order)
  const input = parse(z.object({ quote_id:id,approve:z.boolean() }),req.body)
  await changeTicket(order,async ticket => {
    await access(ticket,user.id)
    if (ticket.customer_id !== user.id) throw forbidden()
    if (ticket.status !== 'quoted') throw conflict('Tiket tidak memiliki penawaran yang aktif.')
    const quote = ticket.quotes.find(q => q.id === input.quote_id && q.status === 'pending')
    if (!quote) throw conflict('Penawaran telah berubah. Muat ulang tiket.')
    quote.status = input.approve ? 'approved' : 'rejected'
    event(ticket,user.id,input.approve ? 'approved' : 'diagnosis',input.approve ? null : 'Pelanggan menolak penawaran biaya.')
  })
  res.status(201).json({ ok:true })
})
orderRoutes.post('/:order/payment',async (req,res) => {
  const user = await actor(req)
  const order = parse(id,req.params.order)
  const input = parse(z.object({ method:z.enum(['cash','bank_transfer','no_charge']),amount:z.number().int().min(0).max(200_000_000) }),req.body)
  const payment = await changeTicket(order,async ticket => {
    if ((await access(ticket,user.id)).role !== 'manager') throw forbidden()
    if (ticket.status !== 'ready' || ticket.payment) throw conflict('Pembayaran tidak tersedia atau sudah tercatat.')
    if (ticket.checkout && ticket.checkout.status !== 'closed') throw conflict('Periksa status checkout online sebelum mencatat pembayaran di toko.')
    const bill = approvedBill(ticket)
    if (input.amount !== bill.amount) throw conflict('Nominal pembayaran harus sama dengan total yang disetujui.')
    if ((input.amount === 0) !== (input.method === 'no_charge')) throw conflict('Metode pembayaran tidak sesuai dengan nominal.')
    ticket.payment = receipt(bill.quote_id,bill.amount,input.method,user.id)
    const { recorded_by,...confirmation } = ticket.payment
    return confirmation
  })
  res.status(201).json(payment)
})
orderRoutes.post('/:order/review',async (req,res) => {
  const user = await actor(req)
  const order = parse(id,req.params.order)
  const input = parse(z.object({ rating:z.number().int().min(1).max(5),comment:words(3,500),public:z.boolean().default(false) }),req.body)
  await changeTicket(order,async ticket => {
    await access(ticket,user.id)
    if (ticket.customer_id !== user.id) throw forbidden()
    if (ticket.status !== 'completed') throw conflict('Ulasan tersedia setelah servis selesai.')
    if (ticket.review) throw conflict('Tiket sudah memiliki ulasan.')
    ticket.review = { ...input,created_at:new Date() }
  })
  res.status(201).json({ ok:true })
})
orderRoutes.post('/:order/review/visibility',async (req,res) => {
  const user = await actor(req)
  const order = parse(id,req.params.order)
  const input = parse(z.object({ public:z.boolean() }),req.body)
  await changeTicket(order,ticket => {
    if (ticket.customer_id !== user.id || !ticket.review) throw missing('Ulasan tidak ditemukan.')
    ticket.review.public = input.public
  })
  res.status(201).json({ ok:true })
})

