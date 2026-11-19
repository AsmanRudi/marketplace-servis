import { randomUUID } from 'node:crypto'
import { shops, tickets, type Shop, type Ticket } from './db'
import { conflict, missing } from './http'

export const transitions: Record<string,string[]> = {
  submitted:['accepted','cancelled'],accepted:['received','cancelled'],received:['diagnosis'],
  diagnosis:['cancelled'],approved:['repairing','parts'],repairing:['parts','ready'],parts:['repairing'],ready:['completed'],
}
export const techSteps = ['diagnosis','repairing','parts','ready']
export function roleFor(shop: Shop,user: string) {
  return shop.members.find(member => member.user_id === user)?.role ?? null
}
export async function access(ticket: Ticket,user: string) {
  const shop = await shops.findOne({ _id:ticket.shop_id })
  if (!shop) throw missing('Toko tidak ditemukan.')
  const role = roleFor(shop,user)
  const assigned = role === 'technician' && ticket.technician_id === user
  if (ticket.customer_id !== user && role !== 'manager' && !assigned) throw missing('Tiket tidak ditemukan.')
  return { shop,role,assigned }
}
export async function loadTicket(id: string) {
  const ticket = await tickets.findOne({ _id:id })
  if (!ticket) throw missing('Tiket tidak ditemukan.')
  return ticket
}
export async function changeTicket<T>(id: string,apply: (ticket: Ticket) => T | Promise<T>) {
  // Each write replaces one aggregate and is conditional on the revision it read.
  for (let retry = 0; retry < 8; retry++) {
    const ticket = await loadTicket(id)
    const revision = ticket.revision
    const output = await apply(ticket)
    ticket.revision = revision+1
    if ((await tickets.replaceOne({ _id:id,revision },ticket)).modifiedCount) return output
  }
  throw conflict('Tiket sedang diperbarui. Muat ulang dan coba lagi.')
}
export function event(ticket: Ticket,user: string,status: string,note: string|null = null) {
  ticket.status = status
  ticket.events.push({ actor_id:user,status,note,created_at:new Date() })
}
export function approvedBill(ticket: Ticket) {
  const quote = ticket.quotes.find(item => item.status === 'approved')
  if (!quote) throw conflict('Belum ada biaya yang disetujui.')
  return { quote_id:quote.id,amount:quote.labor+quote.parts }
}
export function receipt(quote_id: string,amount: number,method: string,recorded_by: string|null) {
  return { id:randomUUID(),quote_id,amount,method,recorded_by,recorded_at:new Date() }
}
export function onlineBlocks(ticket: Ticket) {
  return ticket.checkout?.status === 'review_required' || ticket.checkout?.status === 'pending'
}
export function ticketView(ticket: Ticket,shop: Shop,user: string) {
  const { _id,revision,quotes,events,review,payment,checkout,service_case,...list } = ticket
  return { ...list,id:_id,role:roleFor(shop,user),dropoff_address:['submitted','cancelled'].includes(ticket.status) ? null : shop.dropoff_address }
}
