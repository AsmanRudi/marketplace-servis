import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { z } from 'zod'
import { actor, hashPassword } from './auth'
import { products, sessions, shops, tickets, users, technicianProfiles, type Shop, type Ticket } from './db'
import { forbidden, HttpError, id, missing, parse, words } from './http'

export const adminRoutes = Router()
const adminOnly = async (req:Parameters<typeof actor>[0]) => {
  const current = await actor(req)
  if (!current.platform_admin) throw forbidden()
  return current
}
const localPhotoUrl = z.string().regex(/^\/api\/admin\/media\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i)
const photoUrl = z.union([z.url({ protocol:/^https$/ }).max(1500),localPhotoUrl]).nullable().optional()
const backendDirectory = resolve(createRequire(resolve(process.cwd(),'package.json')).resolve('backend/package.json'),'..')
const mediaDirectory = resolve(backendDirectory,'uploads')
const mediaTypes = new Map([['image/jpeg','.jpg'],['image/png','.png'],['image/webp','.webp']])
function mediaType(buffer:Buffer):string|null {
  if (buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff) return 'image/jpeg'
  if (buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png'
  if (buffer.length>=12&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP') return 'image/webp'
  return null
}
adminRoutes.post('/uploads',async (req,res,next) => {
  try { await adminOnly(req) } catch (error) { next(error);return }
  const raw = (await import('express')).default.raw({type:[...mediaTypes.keys()],limit:'5mb'})
  raw(req,res,async error => {
    if(error) { next(error);return }
    try {
      if(!Buffer.isBuffer(req.body)||req.body.length===0) throw new HttpError(400,'Pilih foto JPEG, PNG, atau WebP terlebih dahulu.')
      const type=mediaType(req.body),declared=req.headers['content-type']?.split(';')[0]
      if(!type||type!==declared) throw new HttpError(415,'Format foto tidak sesuai. Gunakan JPEG, PNG, atau WebP.')
      const filename=randomUUID()+mediaTypes.get(type)!,url='/api/admin/media/'+filename
      await mkdir(mediaDirectory,{recursive:true})
      await writeFile(resolve(mediaDirectory,filename),req.body,{flag:'wx'})
      res.status(201).json({url})
    } catch (failure) { next(failure) }
  })
})
adminRoutes.get('/media/:filename',async (req,res,next) => {
  const filename=req.params.filename
  if(!/^[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(filename)) { res.status(404).end();return }
  try {
    const content=await readFile(resolve(mediaDirectory,filename)),type=mediaType(content)
    if(!type) { res.status(404).end();return }
    res.set({ 'Content-Type':type,'Content-Length':String(content.length),'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff' }).send(content)
  } catch (error) { if((error as NodeJS.ErrnoException).code==='ENOENT') { res.status(404).end();return } next(error) }
})
const shopInput = z.object({ name:words(2,100),city:words(2,80),district:words(2,80),description:words(10,500),dropoff_address:words(10,200).nullable(),photo_url:photoUrl })
const productInput = z.object({ shop_id:id,name:words(2,100),category:z.enum(['phone','laptop','phone_accessory','laptop_accessory']),condition:z.enum(['new','used']),description:words(10,600),price:z.number().int().min(1).max(100_000_000),stock:z.number().int().min(0).max(10000),warranty_days:z.number().int().min(0).max(730),photo_url:z.union([z.url({protocol:/^https$/}).max(1500),localPhotoUrl]).nullable(),condition_notes:words(5,500).nullable(),inspection_notes:words(10,500).nullable().optional() }).superRefine((value,ctx)=>{ if(value.condition==='used'&&(!value.photo_url||!value.condition_notes||!value.inspection_notes||value.stock>1)) ctx.addIssue({code:'custom',message:'Produk bekas memerlukan foto, catatan kondisi dan pemeriksaan; stok maksimal satu.'}) })
adminRoutes.get('/tickets',async (req,res) => {
  await adminOnly(req)
  const rows = await tickets.find({}).project({
    _id:1,shop_id:1,shop_name:1,service_name:1,device:1,device_model:1,customer_id:1,
    technician_name:1,status:1,created_at:1,completed_at:1,payment:1,checkout:1,
  }).sort({ created_at:-1,_id:1 }).limit(500).toArray()
  const customerIds = [...new Set(rows.map(row => row.customer_id))]
  const accounts = await users.find({ _id:{ $in:customerIds } }).project({ _id:1,name:1,email:1 }).toArray()
  const accountById = new Map(accounts.map(account => [account._id,account]))
  res.json(rows.map(row => ({ id:row._id,shop_id:row.shop_id,shop_name:row.shop_name,service_name:row.service_name,
    device:row.device,device_model:row.device_model,status:row.status,created_at:row.created_at,completed_at:row.completed_at,
    customer:accountById.get(row.customer_id) ?? null,technician_name:row.technician_name,
    payment_status:row.payment ? 'paid' : row.checkout?.status ?? 'unpaid' })))
})
adminRoutes.post('/products',async (req,res) => {
  await adminOnly(req)
  const input=parse(productInput,req.body)
  if (!(await shops.findOne({_id:input.shop_id},{projection:{_id:1}}))) throw missing('Toko tidak ditemukan.')
  const productId=randomUUID()
  await products.insertOne({_id:productId,...input,published:true,created_at:new Date()})
  res.status(201).json({id:productId})
})
adminRoutes.put('/products/:product',async (req,res) => {
  await adminOnly(req)
  const productId=parse(id,req.params.product),input=parse(productInput,req.body)
  if (!(await shops.findOne({_id:input.shop_id},{projection:{_id:1}}))) throw missing('Toko tidak ditemukan.')
  if (!(await products.updateOne({_id:productId},{$set:input})).matchedCount) throw missing('Produk tidak ditemukan.')
  res.json({id:productId})
})
adminRoutes.delete('/products/:product',async (req,res) => {
  await adminOnly(req)
  const productId=parse(id,req.params.product)
  if (!(await products.deleteOne({_id:productId})).deletedCount) throw missing('Produk tidak ditemukan.')
  res.status(204).end()
})
adminRoutes.get('/products',async (req,res) => {
  if (!(await actor(req)).platform_admin) throw forbidden()
  const rows = await products.aggregate([
    { $lookup:{ from:'shops',localField:'shop_id',foreignField:'_id',as:'shop' } },
    { $unwind:{ path:'$shop',preserveNullAndEmptyArrays:true } },
    { $sort:{ created_at:-1,_id:1 } },{ $limit:200 },
    { $project:{ _id:0,id:'$_id',shop_id:1,name:1,category:1,condition:1,description:1,price:1,stock:1,warranty_days:1,photo_url:1,condition_notes:1,inspection_notes:1,published:1,
      shop_name:'$shop.name',shop_city:'$shop.city' } },
  ]).toArray()
  res.json(rows)
})
adminRoutes.post('/products/:product/visibility',async (req,res) => {
  if (!(await actor(req)).platform_admin) throw forbidden()
  const productId = parse(id,req.params.product)
  const { published } = parse(z.object({ published:z.boolean() }),req.body)
  const result = await products.updateOne({ _id:productId },{ $set:{ published } })
  if (!result.matchedCount) throw missing('Produk tidak ditemukan.')
  res.json({ id:productId,published })
})
adminRoutes.get('/users',async (req,res) => {
  if (!(await actor(req)).platform_admin) throw forbidden()
  const [accounts,memberships] = await Promise.all([
    users.find({}).project({ password:0 }).sort({ created_at:-1,_id:1 }).limit(500).toArray(),
    shops.find({}).project({ _id:1,name:1,members:1 }).toArray(),
  ])
  const roles = new Map<string,string[]>()
  for (const shop of memberships) for (const member of shop.members) {
    const label = `${member.role === 'manager' ? 'Pengelola' : 'Teknisi'} · ${shop.name}`
    roles.set(member.user_id,[...(roles.get(member.user_id) ?? []),label])
  }
  res.json(accounts.map(({ _id,name,email,platform_admin,disabled,created_at,photo_url }) => ({
    id:_id,name,email,platform_admin,disabled:disabled ?? false,created_at:created_at ?? null,photo_url:photo_url ?? null,memberships:roles.get(_id) ?? [],
  })))
})
adminRoutes.post('/users/:user/status',async (req,res) => {
  const current = await actor(req)
  if (!current.platform_admin) throw forbidden()
  const userId = parse(id,req.params.user)
  const { disabled } = parse(z.object({ disabled:z.boolean() }),req.body)
  if (disabled && userId === current.id) throw new HttpError(409,'Anda tidak dapat menonaktifkan akun admin yang sedang digunakan.')
  const target = await users.findOne({ _id:userId },{ projection:{ platform_admin:1 } })
  if (!target) throw missing('Akun tidak ditemukan.')
  if (disabled && target.platform_admin) throw new HttpError(409,'Akun admin platform dilindungi dari penonaktifan melalui menu ini.')
  await users.updateOne({ _id:userId },{ $set:{ disabled } })
  if (disabled) await sessions.deleteMany({ user_id:userId })
  res.json({ id:userId,disabled })
})
adminRoutes.post('/users',async (req,res) => {
  await adminOnly(req)
  const input=parse(z.object({name:words(2,100),email:z.email().max(254).transform(value=>value.toLowerCase()),password:z.string().min(10).max(128),photo_url:photoUrl}),req.body)
  const user={...input,photo_url:input.photo_url ?? null,_id:randomUUID(),password:await hashPassword(input.password),platform_admin:false,disabled:false,created_at:new Date()}
  try { await users.insertOne(user) } catch(error) { if((error as {code?:number}).code===11000) throw new HttpError(409,'Email sudah digunakan.'); throw error }
  res.status(201).json({id:user._id})
})
adminRoutes.put('/users/:user',async (req,res) => {
  const current=await adminOnly(req),userId=parse(id,req.params.user)
  const input=parse(z.object({name:words(2,100),email:z.email().max(254).transform(value=>value.toLowerCase()),photo_url:photoUrl}),req.body)
  if(userId===current.id&&(input.name!==current.name||input.email!==current.email)) throw new HttpError(409,'Nama dan email admin sendiri tidak dapat diubah melalui menu ini.')
  try { if(!(await users.updateOne({_id:userId},{$set:input})).matchedCount) throw missing('Akun tidak ditemukan.') }
  catch(error) { if((error as {code?:number}).code===11000) throw new HttpError(409,'Email sudah digunakan.'); throw error }
  res.json({id:userId})
})
adminRoutes.delete('/users/:user',async (req,res) => {
  const current=await adminOnly(req),userId=parse(id,req.params.user)
  if(userId===current.id) throw new HttpError(409,'Akun admin yang sedang digunakan tidak dapat dihapus.')
  const target=await users.findOne({_id:userId},{projection:{platform_admin:1}})
  if(!target) throw missing('Akun tidak ditemukan.')
  if(target.platform_admin) throw new HttpError(409,'Akun admin dilindungi.')
  const [membership,ticket]=await Promise.all([shops.findOne({'members.user_id':userId},{projection:{_id:1}}),tickets.findOne({$or:[{customer_id:userId},{technician_id:userId}]},{projection:{_id:1}})])
  if(membership||ticket) throw new HttpError(409,'Akun memiliki riwayat toko atau servis. Nonaktifkan akun agar riwayat tetap utuh.')
  await Promise.all([users.deleteOne({_id:userId}),sessions.deleteMany({user_id:userId}),technicianProfiles.deleteOne({_id:userId})])
  res.status(204).end()
})
adminRoutes.get('/shops',async (req,res) => {
  if (!(await actor(req)).platform_admin) throw forbidden()
  const rows = await shops.find({}).sort({ created_at:-1,_id:1 }).limit(500).toArray()
  const counts = await products.aggregate<{ _id:string; total:number }>([
    { $group:{ _id:'$shop_id',total:{ $sum:1 } } },
  ]).toArray()
  const productCounts = new Map(counts.map(row => [row._id,row.total]))
  res.json(rows.map(shop => ({ id:shop._id,name:shop.name,city:shop.city,district:shop.district,description:shop.description,dropoff_address:shop.dropoff_address,photo_url:shop.photo_url ?? null,verified:shop.verified,
    demo:shop.demo ?? false,created_at:shop.created_at,members:shop.members.length,
    technicians:shop.members.filter(member => member.role === 'technician').length,products:productCounts.get(shop._id) ?? 0,
  })))
})
adminRoutes.post('/shops/:shop/verification',async (req,res) => {
  if (!(await actor(req)).platform_admin) throw forbidden()
  const shopId = parse(id,req.params.shop)
  const { verified } = parse(z.object({ verified:z.boolean() }),req.body)
  const result = await shops.updateOne({ _id:shopId },{ $set:{ verified } })
  if (!result.matchedCount) throw missing('Toko tidak ditemukan.')
  res.json({ id:shopId,verified })
})
adminRoutes.post('/shops',async (req,res) => {
  await adminOnly(req)
  const input=parse(shopInput.extend({manager_email:z.email().max(254).transform(value=>value.toLowerCase())}),req.body)
  const owner=await users.findOne({email:input.manager_email},{projection:{_id:1,name:1}})
  if(!owner) throw missing('Akun pengelola belum terdaftar.')
  const shopId=randomUUID(),{manager_email,...data}=input
  await shops.insertOne({_id:shopId,...data,verified:false,created_at:new Date(),services:[],members:[{user_id:owner._id,name:owner.name,role:'manager'}]})
  res.status(201).json({id:shopId})
})
adminRoutes.put('/shops/:shop',async (req,res) => {
  await adminOnly(req)
  const shopId=parse(id,req.params.shop),input=parse(shopInput,req.body)
  if(!(await shops.updateOne({_id:shopId},{$set:input})).matchedCount) throw missing('Toko tidak ditemukan.')
  await tickets.updateMany({shop_id:shopId},{$set:{shop_name:input.name}})
  res.json({id:shopId})
})
adminRoutes.delete('/shops/:shop',async (req,res) => {
  await adminOnly(req)
  const shopId=parse(id,req.params.shop)
  const [ticket,product]=await Promise.all([tickets.findOne({shop_id:shopId},{projection:{_id:1}}),products.findOne({shop_id:shopId},{projection:{_id:1}})])
  if(ticket||product) throw new HttpError(409,'Toko memiliki riwayat tiket atau produk. Tangguhkan publikasinya agar data tetap utuh.')
  if(!(await shops.deleteOne({_id:shopId})).deletedCount) throw missing('Toko tidak ditemukan.')
  res.status(204).end()
})
adminRoutes.get('/technicians',async (req,res) => {
  if (!(await actor(req)).platform_admin) throw forbidden()
  const [profiles,accounts,shopRows] = await Promise.all([
    technicianProfiles.find({}).sort({ verified:1,created_at:-1 }).limit(500).toArray(),
    users.find({}).project({ _id:1,name:1,email:1,disabled:1,photo_url:1 }).toArray(),
    shops.find({ 'members.role':'technician' }).project<Pick<Shop,'_id'|'name'|'city'|'members'>>({ _id:1,name:1,city:1,members:1 }).toArray(),
  ])
  const accountsById = new Map(accounts.map(user => [user._id,user]))
  const independentIds = new Set(profiles.map(profile => profile._id))
  const results:{ id:string;name:string;email:string;specialty:string;city:string;verified:boolean;disabled:boolean;photo_url:string|null;kind:'independent'|'anggota toko';created_at:Date|null;shops:string[] }[] = profiles.map(profile => {
    const account = accountsById.get(profile._id)
    return { id:profile._id,name:account?.name ?? 'Akun tidak tersedia',email:account?.email ?? '',specialty:profile.specialty,
      city:profile.city,verified:profile.verified,disabled:account?.disabled ?? false,photo_url:profile.photo_url ?? account?.photo_url ?? null,kind:'independent',created_at:profile.created_at,shops:[] as string[] }
  })
  for (const shop of shopRows) for (const member of shop.members.filter(row => row.role === 'technician')) {
    if (independentIds.has(member.user_id)) {
      const existing = results.find(row => row.id === member.user_id)
      if (existing) existing.shops.push(shop.name)
      continue
    }
    const account = accountsById.get(member.user_id)
    const existing=results.find(row=>row.id===member.user_id)
    if(existing) { existing.shops.push(shop.name);continue }
    results.push({ id:member.user_id,name:account?.name ?? member.name,email:account?.email ?? '',specialty:member.specialty ?? 'Belum diisi',
      city:shop.city,verified:true,disabled:account?.disabled ?? false,photo_url:account?.photo_url ?? null,kind:'anggota toko',created_at:null,shops:[shop.name] })
  }
  res.json(results)
})
adminRoutes.post('/technicians/:technician/verification',async (req,res) => {
  if (!(await actor(req)).platform_admin) throw forbidden()
  const technicianId = parse(id,req.params.technician)
  const { verified } = parse(z.object({ verified:z.boolean() }),req.body)
  const result = await technicianProfiles.updateOne({ _id:technicianId },{ $set:{ verified } })
  if (!result.matchedCount) throw missing('Pengajuan teknisi independen tidak ditemukan.')
  res.json({ id:technicianId,verified })
})
adminRoutes.put('/technicians/:technician',async (req,res) => {
  await adminOnly(req)
  const technicianId=parse(id,req.params.technician),input=parse(z.object({specialty:words(2,100).optional(),city:words(2,80).optional(),photo_url:photoUrl}),req.body)
  const profile=await technicianProfiles.findOne({_id:technicianId},{projection:{_id:1}})
  const member=await shops.findOne({'members.user_id':technicianId,'members.role':'technician'},{projection:{_id:1}})
  if(!profile&&!member) throw missing('Data teknisi tidak ditemukan.')
  if(input.specialty!==undefined||input.city!==undefined) {
    if(!profile) throw new HttpError(409,'Keahlian dan kota teknisi anggota toko dikelola dari data toko.')
    await technicianProfiles.updateOne({_id:technicianId},{$set:{...(input.specialty!==undefined?{specialty:input.specialty}:{}),...(input.city!==undefined?{city:input.city}:{})}})
  }
  if(input.photo_url!==undefined) {
    if(profile) await technicianProfiles.updateOne({_id:technicianId},{$set:{photo_url:input.photo_url}})
    await users.updateOne({_id:technicianId},{$set:{photo_url:input.photo_url}})
  }
  res.json({id:technicianId})
})
adminRoutes.delete('/technicians/:technician',async (req,res) => {
  await adminOnly(req)
  const technicianId=parse(id,req.params.technician)
  if(!(await technicianProfiles.deleteOne({_id:technicianId})).deletedCount) throw missing('Profil teknisi independen tidak ditemukan.')
  res.status(204).end()
})
adminRoutes.get('/overview',async (req,res) => {
  if (!(await actor(req)).platform_admin) throw forbidden()
  const [shopsTotal, verified, pending, byStatus, activeCases, caseList] = await Promise.all([
    shops.countDocuments(),
    shops.countDocuments({ verified:true }),
    shops.find({ verified:false }).project<Pick<Shop,'_id'|'name'|'city'|'district'|'description'|'dropoff_address'|'created_at'>>({
      name:1,city:1,district:1,description:1,dropoff_address:1,created_at:1,
    }).sort({ created_at:1,_id:1 }).limit(20).toArray(),
    tickets.aggregate<{ _id:string; total:number }>([{ $group:{ _id:'$status',total:{ $sum:1 } } }]).toArray(),
    tickets.countDocuments({ 'service_case.status':{ $in:['open','in_review'] } }),
    tickets.find({ 'service_case.status':{ $in:['open','in_review'] } }).project<
      Pick<Ticket,'_id'|'shop_name'|'device'|'service_case'>
    >({ shop_name:1,device:1,'service_case.kind':1,'service_case.status':1,'service_case.updated_at':1 })
      .sort({ 'service_case.updated_at':-1,_id:1 }).limit(6).toArray(),
  ])
  res.json({
    shops:{ total:shopsTotal,verified,pending:shopsTotal-verified },
    tickets:{ total:byStatus.reduce((sum,row) => sum+row.total,0),by_status:byStatus.map(row => ({ status:row._id,total:row.total })) },
    cases:{ active:activeCases,recent:caseList.map(item => ({
      ticket_id:item._id,shop_name:item.shop_name,device:item.device,kind:item.service_case?.kind,
      status:item.service_case?.status,updated_at:item.service_case?.updated_at,
    })) },
    applications:pending.map(({ _id,...shop }) => ({ id:_id,...shop })),
  })
})

