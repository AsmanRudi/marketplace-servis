import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { Document } from 'mongodb'
import { actor } from './auth'
import { products, shops } from './db'
import { forbidden, HttpError, id, missing, parse, words } from './http'

const input = z.object({
  name:words(2,100),category:z.enum(['phone','laptop','phone_accessory','laptop_accessory']),
  condition:z.enum(['new','used']),description:words(10,600),
  price:z.number().int().min(1).max(100_000_000),stock:z.number().int().min(0).max(10000),
  warranty_days:z.number().int().min(0).max(730),photo_url:z.url({ protocol:/^https$/ }).max(1500).nullable(),
  condition_notes:words(5,500).nullable(),
  inspection_notes:words(10,500).nullable().optional(),
}).superRefine((product,context) => {
  if (product.condition !== 'used') return
  if (!product.photo_url) context.addIssue({ code:'custom',path:['photo_url'],message:'Foto aktual wajib untuk unit bekas.' })
  if (!product.condition_notes) context.addIssue({ code:'custom',path:['condition_notes'],message:'Isi kondisi dan kelengkapan unit bekas.' })
  if (!product.inspection_notes) context.addIssue({ code:'custom',path:['inspection_notes'],message:'Catat hasil pemeriksaan fungsi unit bekas.' })
  if (product.stock > 1) context.addIssue({ code:'custom',path:['stock'],message:'Satu produk bekas mewakili satu unit.' })
})
export const productRoutes = Router()
function browse(filter:Document,limit:number) {
  return products.aggregate([
    { $match:{ ...filter,published:true } },{ $sort:{ created_at:-1,_id:1 } },
    { $lookup:{ from:'shops',localField:'shop_id',foreignField:'_id',as:'shop' } },
    { $unwind:'$shop' },{ $match:{ 'shop.verified':true } },{ $limit:limit },
    { $project:{ _id:0,id:'$_id',shop_id:1,shop_name:'$shop.name',city:'$shop.city',demo:{ $ifNull:['$shop.demo',false] },
      name:1,category:1,condition:1,description:1,price:1,stock:1,warranty_days:1,photo_url:1,condition_notes:1,inspection_notes:1 } },
  ]).toArray()
}
productRoutes.get('/',async (_req,res) => { res.json(await browse({},100)) })
productRoutes.get('/:product',async (req,res) => {
  const [item] = await browse({ _id:parse(id,req.params.product) },1)
  if (!item) throw missing('Produk tidak tersedia.')
  res.json(item)
})
async function requireManager(shop: string,user: string) {
  if (!(await shops.findOne({ _id:shop,members:{ $elemMatch:{ user_id:user,role:'manager' } } },{ projection:{ _id:1 } }))) throw forbidden()
}
productRoutes.get('/shops/:shop',async (req,res) => {
  const user = await actor(req)
  const shop = parse(id,req.params.shop)
  await requireManager(shop,user.id)
  const rows = await products.find({ shop_id:shop }).sort({ created_at:-1,_id:1 }).limit(100).toArray()
  res.json(rows.map(({ _id, ...product }) => ({ id:_id,...product })))
})
productRoutes.post('/shops/:shop',async (req,res) => {
  const user = await actor(req)
  const shop = parse(id,req.params.shop)
  await requireManager(shop,user.id)
  const item = parse(input,req.body)
  const itemId = randomUUID()
  await products.insertOne({ ...item,_id:itemId,shop_id:shop,created_at:new Date(),published:true })
  res.status(201).json({ id:itemId })
})
productRoutes.post('/shops/:shop/:item',async (req,res) => {
  const user = await actor(req)
  const shop = parse(id,req.params.shop)
  const item = parse(id,req.params.item)
  await requireManager(shop,user.id)
  const update = parse(z.object({ stock:z.number().int().min(0).max(10000),published:z.boolean() }),req.body)
  const filter = { _id:item,shop_id:shop }
  const before = await products.findOne(filter,{ projection:{ condition:1 } })
  if (!before) throw missing('Produk tidak ditemukan.')
  if (before.condition === 'used' && update.stock > 1) throw new HttpError(400,'Stok unit bekas maksimal 1.')
  await products.updateOne(filter,{ $set:update })
  res.status(201).json({ id:item })
})

