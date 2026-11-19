import { Router } from 'express'
import { actor } from './auth'
import { tickets, type Checkout } from './db'
import { badGateway, conflict, forbidden, id, missing, parse } from './http'
import { createCheckout, fetchCheckoutStatus, midtransEnabled, notification, validNotification } from './midtrans'
import { access, approvedBill, changeTicket, loadTicket, receipt } from './ticket-state'

export const checkoutRoutes = Router()
async function reconcile(order: string,checkout: Checkout) {
  const remote = await fetchCheckoutStatus(checkout.provider_order_id)
  if (!remote) return
  if (remote.order_id !== checkout.provider_order_id || !/^\d+(?:\.00)?$/.test(remote.gross_amount) ||
    Number(remote.gross_amount) !== checkout.amount) throw badGateway('Tagihan Midtrans tidak cocok.')
  const success = remote.status_code === '200' && (
    (remote.transaction_status === 'settlement' && (!remote.fraud_status || remote.fraud_status === 'accept')) ||
    (remote.transaction_status === 'capture' && remote.fraud_status === 'accept'))
  const refund = ['refund','partial_refund','chargeback','partial_chargeback'].includes(remote.transaction_status)
  const terminal = ['deny','cancel','expire','failure'].includes(remote.transaction_status)
  if (!success && !refund && !terminal) return

  await changeTicket(order,ticket => {
    const current = ticket.checkout
    if (!current || current.provider_order_id !== checkout.provider_order_id) return
    if (refund || (terminal && current.status === 'paid') || (success && current.status === 'closed')) {
      current.status = 'review_required'
    } else if (current.status === 'pending' && success) {
      if (ticket.payment) current.status = 'review_required'
      else {
        ticket.payment = receipt(current.quote_id,current.amount,'midtrans_sandbox',null)
        current.status = 'paid'
      }
    } else if (current.status === 'pending' && terminal) current.status = 'closed'
  })
}
checkoutRoutes.post('/:order/checkout',async (req,res) => {
  const user = await actor(req)
  const order = parse(id,req.params.order)
  const checkout = await changeTicket(order,async ticket => {
    await access(ticket,user.id)
    if (ticket.customer_id !== user.id) throw forbidden()
    if (!midtransEnabled() || ticket.status !== 'ready') throw conflict('Checkout sandbox tidak tersedia.')
    if (ticket.payment) throw conflict('Pembayaran tiket sudah tercatat.')
    const bill = approvedBill(ticket)
    if (bill.amount === 0) throw conflict('Tiket ini bebas biaya.')
    ticket.checkout ??= { provider_order_id:'MS-'+order,...bill,status:'pending',redirect_url:null }
    if (ticket.checkout.status !== 'pending') throw conflict('Checkout sudah ditutup. Hubungi toko.')
    return ticket.checkout
  })
  const link = checkout.redirect_url ?? await createCheckout(checkout.provider_order_id,checkout.amount)
  const redirect_url = await changeTicket(order,ticket => {
    if (ticket.checkout?.status !== 'pending') throw conflict('Status checkout berubah. Muat ulang tiket.')
    ticket.checkout.redirect_url ??= link
    return ticket.checkout.redirect_url
  })
  res.status(201).json({ redirect_url })
})
checkoutRoutes.post('/:order/checkout/status',async (req,res) => {
  const user = await actor(req)
  const order = parse(id,req.params.order)
  const ticket = await loadTicket(order)
  const { role } = await access(ticket,user.id)
  if (!ticket.checkout || (ticket.customer_id !== user.id && role !== 'manager')) throw missing('Checkout tidak ditemukan.')
  await reconcile(order,ticket.checkout)
  res.status(201).json({ ok:true })
})
checkoutRoutes.post('/midtrans/webhook',async (req,res) => {
  const body = parse(notification,req.body)
  if (!validNotification(body)) throw forbidden()
  const ticket = await tickets.findOne({ 'checkout.provider_order_id':body.order_id })
  if (ticket?.checkout) await reconcile(ticket._id,ticket.checkout)
  res.json({ ok:true })
})

