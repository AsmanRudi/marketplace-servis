import type { ErrorRequestHandler } from 'express'
import { z } from 'zod'

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export const badGateway = (message: string) => new HttpError(502,message)
export const conflict = (message: string) => new HttpError(409,message)
export const forbidden = () => new HttpError(403,'Anda tidak memiliki akses.')
export const missing = (message: string) => new HttpError(404,message)
export const id = z.uuid()
export const words = (min: number, max: number) => z.string().trim().min(min).max(max)

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new HttpError(400,'Periksa kolom yang diisi: ' + result.error.issues.map(issue => issue.path.join('.')).filter(Boolean).join(', '))
  return result.data
}
export const errors: ErrorRequestHandler = (error,_req,res,_next) => {
  if (error instanceof HttpError) { res.status(error.status).json({ message:error.message }); return }
  if (error?.type === 'entity.parse.failed') { res.status(400).json({ message:'Format JSON tidak valid.' }); return }
  if (error?.type === 'entity.too.large') { res.status(413).json({ message:'Permintaan terlalu besar.' }); return }
  console.error('Kesalahan API',error?.name ?? 'Error',error?.code ?? '')
  res.status(500).json({ message:'Terjadi kesalahan pada layanan.' })
}
