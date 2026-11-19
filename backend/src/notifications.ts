import { Router } from 'express'
import { z } from 'zod'
import { actor } from './auth'
import { notificationReads, tickets, type Ticket } from './db'
import { id, missing, parse } from './http'

const customerStatuses = ['accepted','quoted','ready','cancelled']
const readId = (user: string,ticket: string,event: number) => user+':'+ticket+':'+event
type Item = { ticket_id:string; event:number; status:string; created_at:Date; device_model:string; shop_name:string }

export const notifications = Router()
notifications.get('/',async (req,res) => {
  const user = await actor(req)
  const items = await tickets.aggregate<Item>([
    { $match:{ customer_id:user.id,'events.status':{ $in:customerStatuses } } },
    { $unwind:{ path:'$events',includeArrayIndex:'event' } },
    { $match:{ 'events.status':{ $in:customerStatuses },'events.actor_id':{ $ne:user.id } } },
    { $sort:{ 'events.created_at':-1,_id:1,event:-1 } },
    { $limit:50 },
    { $project:{ _id:0,ticket_id:'$_id',event:1,status:'$events.status',created_at:'$events.created_at',device_model:1,shop_name:1 } },
  ]).toArray()
  const reads = await notificationReads.find({
    _id:{ $in:items.map(item => readId(user.id,item.ticket_id,item.event)) },
  }).project({ _id:1 }).toArray()
  const seen = new Set(reads.map(item => item._id))
  res.json(items.map(item => ({ ...item,read:seen.has(readId(user.id,item.ticket_id,item.event)) })))
})
notifications.post('/read',async (req,res) => {
  const user = await actor(req)
  const input = parse(z.object({ ticket_id:id,event:z.number().int().min(0).max(1000000) }),req.body)
  const eventField = 'events.'+input.event
  const row = await tickets.findOne<Pick<Ticket,'customer_id'|'_id'>>({
    _id:input.ticket_id,customer_id:user.id,
    [eventField+'.status']:{ $in:customerStatuses },[eventField+'.actor_id']:{ $ne:user.id },
  },{ projection:{ _id:1,customer_id:1 } })
  if (!row) throw missing('Notifikasi tidak ditemukan.')
  const _id = readId(user.id,input.ticket_id,input.event)
  await notificationReads.updateOne({ _id },{ $setOnInsert:{ read_at:new Date() } },{ upsert:true })
  res.status(201).json({ ok:true })
})

