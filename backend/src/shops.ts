import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { actor } from './auth'
import { shops, tickets, users } from './db'
import { conflict, forbidden, id, missing, parse, words } from './http'

export const shopRoutes = Router()
const membership = (user: string) => ({ $elemMatch:{ user_id:user,role:'manager' as const } })
shopRoutes.get('/',async (_req,res) => {
  const rows = await shops.find({ verified:true }).sort({ name:1 }).toArray()
  const ratings = await tickets.aggregate<{ _id:string; rating:number }>([
    { $match:{ shop_id:{ $in:rows.map(shop => shop._id) },'review.rating':{ $exists:true } } },
    { $group:{ _id:'$shop_id',rating:{ $avg:'$review.rating' } } },
  ]).toArray()
  const byShop = new Map(ratings.map(entry => [entry._id,Math.round(entry.rating*10)/10]))
  res.json(rows.map(shop => ({
    id:shop._id,name:shop.name,city:shop.city,district:shop.district,description:shop.description,
    photo_url:shop.photo_url ?? null,location:shop.location ?? null,demo:shop.demo ?? false,
    services:shop.services,technicians:shop.members.filter(member => member.role === 'technician')
      .map(member => ({ id:member.user_id,name:member.name,specialty:member.specialty })),
    rating:byShop.get(shop._id) ?? null,
  })))
})
shopRoutes.get('/manage',async (req,res) => {
  const user = await actor(req)
  const rows = await shops.find(user.platform_admin ? {} : { members:membership(user.id) }).sort({ created_at:-1 }).toArray()
  res.json(rows.map(({ _id,members,...shop }) => ({ ...shop,id:_id,
    role:members.find(member => member.user_id === user.id)?.role ?? null,
    technicians:members.filter(member => member.role === 'technician').map(member => ({ id:member.user_id,name:member.name })),
  })))
})
shopRoutes.post('/',async (req,res) => {
  const user = await actor(req)
  const input = parse(z.object({ name:words(2,100),city:words(2,80),district:words(2,80),dropoff_address:words(10,200),description:words(10,500) }),req.body)
  const shop = randomUUID()
  await shops.insertOne({ _id:shop,...input,verified:false,created_at:new Date(),services:[],members:[{ user_id:user.id,name:user.name,role:'manager' }] })
  res.status(201).json({ id:shop })
})
shopRoutes.post('/:shop/verify',async (req,res) => {
  if (!(await actor(req)).platform_admin) throw forbidden()
  const shop = parse(id,req.params.shop)
  if (!(await shops.updateOne({ _id:shop },{ $set:{ verified:true } })).matchedCount) throw missing('Toko tidak ditemukan.')
  res.status(201).json({ id:shop })
})
shopRoutes.post('/:shop/profile',async (req,res) => {
  const user = await actor(req)
  const shop = parse(id,req.params.shop)
  const input = parse(z.object({
    photo_url:z.url({ protocol:/^https$/ }).max(1500).nullable(),
    latitude:z.number().min(-90).max(90).nullable(),
    longitude:z.number().min(-180).max(180).nullable(),
  }).refine(data => (data.latitude === null) === (data.longitude === null)),req.body)
  const location = input.latitude !== null && input.longitude !== null
    ? { type:'Point' as const,coordinates:[input.longitude,input.latitude] as [number,number] } : null
  const result = await shops.updateOne({ _id:shop,members:membership(user.id) },{ $set:{ photo_url:input.photo_url,location } })
  if (!result.matchedCount) throw forbidden()
  res.status(201).json({ id:shop })
})
shopRoutes.post('/:shop/services',async (req,res) => {
  const user = await actor(req)
  const shop = parse(id,req.params.shop)
  const input = parse(z.object({ name:words(2,100),device:z.enum(['HP','Laptop']),
    starting_price:z.number().int().min(0).max(100_000_000),warranty_days:z.number().int().min(0).max(730) }),req.body)
  const service = { id:randomUUID(),...input }
  const filter = { _id:shop,members:membership(user.id) }
  const result = await shops.updateOne({ ...filter,'services.199':{ $exists:false } },{ $push:{ services:service } })
  if (!result.matchedCount) {
    if (!(await shops.findOne(filter,{ projection:{ _id:1 } }))) throw forbidden()
    throw conflict('Jumlah layanan toko mencapai batas.')
  }
  res.status(201).json({ id:service.id })
})
shopRoutes.post('/:shop/technicians',async (req,res) => {
  const current = await actor(req)
  const shop = parse(id,req.params.shop)
  const input = parse(z.object({ email:z.email().max(254),specialty:words(2,100) }),req.body)
  const filter = { _id:shop,members:membership(current.id) }
  if (!(await shops.findOne(filter,{ projection:{ _id:1 } }))) throw forbidden()
  const user = await users.findOne({ email:input.email.toLowerCase() })
  if (!user) throw missing('Akun teknisi belum terdaftar.')
  const member = { user_id:user._id,name:user.name,role:'technician' as const,specialty:input.specialty }
  const added = await shops.updateOne({
    _id:shop,$and:[{ members:membership(current.id) },{ 'members.user_id':{ $ne:user._id } }],'members.199':{ $exists:false },
  },{ $push:{ members:member } })
  if (!added.matchedCount) {
    const existing = await shops.updateOne(filter,{ $set:{ 'members.$[target].specialty':input.specialty } },
      { arrayFilters:[{ 'target.user_id':user._id,'target.role':'technician' }] })
    const row = existing.matchedCount && await shops.findOne({ _id:shop,members:{ $elemMatch:{ user_id:user._id,role:'technician' } } },{ projection:{ _id:1 } })
    if (!row) throw conflict('Akun sudah menjadi pengelola atau jumlah anggota toko mencapai batas.')
  }
  res.status(201).json({ user_id:user._id })
})
