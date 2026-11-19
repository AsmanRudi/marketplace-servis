import express from 'express'
import { adminRoutes } from './admin'
import { cases } from './cases'
import { auth } from './auth'
import { client, init } from './db'
import { errors } from './http'
import { notifications } from './notifications'
import { productRoutes } from './products'
import { orderRoutes } from './orders'
import { shopRoutes } from './shops'
import { technicianRoutes } from './technicians'

async function main() {
  await init()
  const app = express()
  app.disable('x-powered-by')
  app.set('case sensitive routing',true)
  const attempts = new Map<string,{ count:number; until:number }>()
  setInterval(() => {
    for (const [ip,value] of attempts) if (value.until < Date.now()) attempts.delete(ip)
  },60_000).unref()
  app.use('/api',(req,res,next) => {
    res.set({ 'X-Content-Type-Options':'nosniff','Cache-Control':'no-store' })
    if (req.method !== 'POST') return next()
    const site = req.headers['sec-fetch-site']
    if (site === 'cross-site' || site === 'same-site') {
      res.status(403).json({ message:'Permintaan lintas situs ditolak.' }); return
    }
    if (!/^\/auth\/(?:login|register)\/?$/i.test(req.path)) return next()
    const ip = req.ip ?? 'unknown'
    const now = Date.now()
    const prior = attempts.get(ip)
    const attempt = !prior || prior.until <= now ? { count:0,until:now+60_000 } : prior
    attempts.set(ip,attempt)
    if (++attempt.count > 12) { res.status(429).json({ message:'Terlalu banyak percobaan. Coba lagi dalam satu menit.' }); return }
    next()
  },express.json({ limit:'16kb' }))
  app.use('/api/auth',auth)
  app.use('/api/admin',adminRoutes)
  app.use('/api/shops',shopRoutes)
  app.use('/api/technicians',technicianRoutes)
  app.use('/api/orders',orderRoutes)
  app.use('/api/products',productRoutes)
  app.use('/api/cases',cases)
  app.use('/api/notifications',notifications)
  app.use('/api',(_req,res) => { res.status(404).json({ message:'Halaman API tidak ditemukan.' }) })
  app.use(errors)
  const server = app.listen(Number(process.env.PORT || 3001),process.env.HOST || '127.0.0.1',() => console.log('Meja Servis API siap.'))
  const close = () => server.close(() => { void client.close() })
  process.once('SIGINT',close)
  process.once('SIGTERM',close)
}
main().catch(async error => {
  console.error('API gagal dimulai:',error?.name ?? 'Error')
  await client.close()
  process.exitCode = 1
})
