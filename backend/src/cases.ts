import { Router } from 'express'
import { z } from 'zod'
import { actor } from './auth'
import { shops, tickets, type Ticket } from './db'
import { conflict, forbidden, id, missing, parse, words } from './http'
import { changeTicket, loadTicket } from './ticket-state'

export const cases = Router()
type Actor = Awaited<ReturnType<typeof actor>>
async function caseRole(ticket: Ticket,user: Actor) {
  if (ticket.customer_id === user.id) return 'customer'
  if (user.platform_admin) return 'admin'
  const shop = await shops.findOne({ _id:ticket.shop_id,members:{ $elemMatch:{ user_id:user.id,role:'manager' } } })
  if (shop) return 'manager'
  throw missing('Kasus tidak ditemukan.')
}
function view(ticket: Ticket) {
  return { ticket_id:ticket._id,shop_name:ticket.shop_name,device_model:ticket.device_model,case:ticket.service_case }
}
cases.get('/',async (req,res) => {
  const user = await actor(req)
  const managed = user.platform_admin ? [] : await shops.find({ members:{ $elemMatch:{ user_id:user.id,role:'manager' } } }).project({ _id:1 }).toArray()
  const rows = await tickets.find({
    'service_case.status':{ $exists:true },
    ...(user.platform_admin ? {} : { $or:[{ customer_id:user.id },{ shop_id:{ $in:managed.map(shop => shop._id) } }] }),
  }).sort({ 'service_case.updated_at':-1,_id:1 }).limit(50).toArray()
  res.json(rows.map(view))
})
cases.get('/:order',async (req,res) => {
  const user = await actor(req)
  const ticket = await loadTicket(parse(id,req.params.order))
  const role = await caseRole(ticket,user)
  if (!ticket.service_case) throw missing('Kasus tidak ditemukan.')
  res.json({ ...view(ticket),role })
})
cases.post('/:order',async (req,res) => {
  const user = await actor(req)
  const order = parse(id,req.params.order)
  const input = parse(z.object({ kind:z.enum(['complaint','warranty']),message:words(10,1500) }),req.body)
  await changeTicket(order,ticket => {
    if (ticket.customer_id !== user.id) throw missing('Tiket tidak ditemukan.')
    if (ticket.service_case) throw conflict('Tiket sudah memiliki kasus.')
    if (!['received','diagnosis','quoted','approved','repairing','parts','ready','completed','cancelled'].includes(ticket.status)
      || (ticket.status === 'cancelled' && !ticket.condition)) throw conflict('Kasus tersedia setelah perangkat diterima toko.')
    const now = new Date()
    if (input.kind === 'warranty' && (!ticket.completed_at || ticket.status !== 'completed' || ticket.warranty_days < 1 ||
      now.getTime() > ticket.completed_at.getTime()+ticket.warranty_days*86_400_000)) throw conflict('Garansi servis tidak aktif.')
    ticket.service_case = { kind:input.kind,status:'open',created_at:now,updated_at:now,
      messages:[{ role:'customer',message:input.message,created_at:now }] }
  })
  res.status(201).json({ ok:true })
})
cases.post('/:order/reply',async (req,res) => {
  const user = await actor(req)
  const order = parse(id,req.params.order)
  const input = parse(z.object({ message:words(3,1500),status:z.enum(['in_review','resolved']).optional() }),req.body)
  await changeTicket(order,async ticket => {
    const role = await caseRole(ticket,user)
    const item = ticket.service_case
    if (!item) throw missing('Kasus tidak ditemukan.')
    if (input.status && role === 'customer') throw forbidden()
    if (item.status === 'resolved') throw conflict('Kasus sudah ditutup.')
    if (item.messages.length >= 200 && input.status !== 'resolved') throw conflict('Batas pesan tercapai. Hubungi admin platform.')
    const now = new Date()
    item.messages.push({ role,message:input.message,created_at:now })
    item.updated_at=now
    if (input.status) item.status=input.status
  })
  res.status(201).json({ ok:true })
})

