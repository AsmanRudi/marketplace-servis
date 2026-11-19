import { Router, type Request, type Response } from 'express'
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { z } from 'zod'
import { sessions, shops, users, type User } from './db'
import { conflict, HttpError, parse, words } from './http'

const derive = promisify(scrypt)
const digest = (token: string) => createHash('sha256').update(token).digest('hex')
const week = 7 * 24 * 60 * 60
const options = { path:'/api',httpOnly:true,sameSite:'lax' as const,secure:process.env.COOKIE_SECURE === 'true' }
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  return salt + ':' + (await derive(password,salt,64) as Buffer).toString('hex')
}
async function matches(password: string, hash: string) {
  const [salt,value] = hash.split(':')
  return timingSafeEqual(await derive(password,salt,64) as Buffer,Buffer.from(value,'hex'))
}
const tokenOf = (req: Request) => req.headers.cookie?.match(/(?:^|;\s*)servis_session=([a-f0-9]{64})(?:;|$)/)?.[1]
const view = (user: User) => ({ id:user._id,name:user.name,email:user.email,platform_admin:user.platform_admin,photo_url:user.photo_url ?? null })
async function sessionUser(req: Request) {
  const token = tokenOf(req)
  if (!token) return null
  const active = await sessions.findOne({ _id:digest(token), expires_at:{ $gt:new Date() } })
  const user = active && await users.findOne({ _id:active.user_id })
  return user && !user.disabled ? view(user) : null
}
export async function actor(req: Request) {
  const user = await sessionUser(req)
  if (!user) throw new HttpError(401,'Silakan masuk terlebih dahulu.')
  return user
}
async function login(user: User,req: Request,res: Response) {
  const token = randomBytes(32).toString('hex')
  const prior = tokenOf(req)
  if (prior) await sessions.deleteOne({ _id:digest(prior) })
  await sessions.insertOne({ _id:digest(token),user_id:user._id,expires_at:new Date(Date.now()+week*1000) })
  res.cookie('servis_session',token,{ ...options,maxAge:week*1000 }).status(201).json(view(user))
}
const credentials = z.object({ email:z.email().max(254).transform(value => value.toLowerCase()),password:z.string().min(10).max(128) })
const dummy = hashPassword('unused-placeholder')
export const auth = Router()
auth.post('/register',async (req,res) => {
  const input = parse(credentials.extend({ name:words(2,100) }),req.body)
  const user = { ...input,_id:randomUUID(),password:await hashPassword(input.password),platform_admin:false,disabled:false,created_at:new Date() }
  try { await users.insertOne(user) }
  catch (error) {
    if ((error as { code?: number }).code === 11000) throw conflict('Akun dengan email tersebut sudah terdaftar.')
    throw error
  }
  await login(user,req,res)
})
auth.post('/login',async (req,res) => {
  const input = parse(credentials,req.body)
  const user = await users.findOne({ email:input.email })
  if (!(await matches(input.password,user?.password ?? await dummy)) || !user || user.disabled) throw new HttpError(401,'Email atau kata sandi salah.')
  await login(user,req,res)
})
auth.get('/me',async (req,res) => {
  const user = await sessionUser(req)
  if (!user) { res.json(null); return }
  const memberships = await shops.find({ 'members.user_id':user.id }).project({ members:1,name:1 }).toArray()
  res.json({ ...user,memberships:memberships.map(shop => ({
    shop_id:shop._id,name:shop.name,role:(shop.members as { user_id:string;role:string }[]).find(member => member.user_id === user.id)?.role,
  })) })
})
auth.post('/logout',async (req,res) => {
  const token = tokenOf(req)
  if (token) await sessions.deleteOne({ _id:digest(token) })
  res.clearCookie('servis_session',options).status(201).json({ ok:true })
})
