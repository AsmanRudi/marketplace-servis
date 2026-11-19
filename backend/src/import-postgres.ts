import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { client, init, sessions, shops, tickets, users } from './db'

const tables = { users,shops,tickets,sessions }
type Kind = keyof typeof tables
type Row = { kind: Kind; document: { _id: string } & Record<string,unknown> }

function dates(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dates)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key,entry]) => [
    key, key.endsWith('_at') && typeof entry === 'string' ? new Date(entry) : dates(entry),
  ]))
}
async function rows() {
  const executable = process.env.PSQL_PATH || 'psql'
  const child = spawn(executable,['-X','-qAt','-w','-v','ON_ERROR_STOP=1','-f',resolve('scripts/export-postgres.sql')],
    { stdio:['ignore','pipe','ignore'] })
  const completed = new Promise<void>((done,reject) => {
    child.once('error',reject)
    child.once('close',code => code === 0 ? done() : reject(new Error('Ekspor PostgreSQL gagal. Periksa PGHOST, PGPORT, PGUSER, PGDATABASE, dan skema lama.')))
  })
  void completed.catch(() => {})
  const records: Row[] = []
  for await (const line of createInterface({ input:child.stdout,crlfDelay:Infinity })) {
    const row = dates(JSON.parse(line)) as Row
    if (!Object.hasOwn(tables,row.kind) || typeof row.document?._id !== 'string') throw new Error('Format ekspor tidak valid.')
    records.push(row)
  }
  await completed
  return records
}
async function run() {
  if (!process.env.PGDATABASE || !process.env.MONGODB_DB) throw new Error('Tetapkan PGDATABASE dan MONGODB_DB secara eksplisit.')
  const records = await rows()
  await init()
  const newRows: Row[] = []
  for (const row of records) {
    const collection = tables[row.kind]
    const existing = await collection.findOne({ _id: row.document._id })
    if (existing && !isDeepStrictEqual(existing,row.document)) {
      throw new Error('Data tujuan berbeda untuk ID yang sama pada koleksi '+row.kind+'. Gunakan database tujuan terpisah.')
    }
    if (!existing && row.kind === 'users' && await users.findOne({ email:String(row.document.email) })) {
      throw new Error('Email sumber sudah digunakan oleh akun lain di MongoDB.')
    }
    if (!existing) newRows.push(row)
  }
  if (process.argv.includes('--apply')) {
    for (const row of newRows) await tables[row.kind].insertOne(row.document as never)
    for (const row of records) {
      if (row.kind === 'sessions' && (row.document.expires_at as Date) <= new Date()) continue
      const imported = await tables[row.kind].findOne({ _id:row.document._id })
      if (!isDeepStrictEqual(imported,row.document)) throw new Error('Verifikasi gagal untuk koleksi '+row.kind+'.')
    }
  }
  const counts = Object.fromEntries(Object.keys(tables).map(kind => [kind,records.filter(row => row.kind === kind).length]))
  console.log(JSON.stringify({ source:process.env.PGDATABASE,target:process.env.MONGODB_DB,counts,newRows:newRows.length,applied:process.argv.includes('--apply') }))
}
run().catch(error => {
  if (typeof error?.code === 'number') console.error('Operasi database gagal. Kode:',error.code)
  else console.error(error?.message)
  process.exitCode=1
}).finally(() => client.close())
