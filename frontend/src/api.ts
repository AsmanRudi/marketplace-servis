export type Shop = {
  id: string; name: string; city: string; district: string; description: string; rating: number | null
  photo_url?: string | null; location?: { type:'Point'; coordinates:[number,number] } | null; demo?: boolean
  services: { id: string; device: 'HP' | 'Laptop'; name: string; starting_price: number; warranty_days: number }[]
  technicians: { id: string; name: string; specialty: string }[]
}
export type ManagedShop = Shop & { role: string | null; verified: boolean; dropoff_address: string | null }
export type Account = { id: string; name: string; platform_admin: boolean; photo_url?:string|null; memberships: { role: string; shop_id: string }[] }
export type Ticket = {
  id: string; shop_id: string; customer_id: string; shop_name: string; service_name: string; device: string;
  device_model: string; technician_id: string | null; preferred_id: string | null; technician_name: string | null;
  role: string | null; status: string; complaint: string; condition: string | null; created_at: string; dropoff_address: string | null; warranty_days: number; completed_at: string | null
}
export type Detail = Ticket & {
  events: { status: string; note: string | null; created_at: string }[]
  quotes: { id: string; diagnosis: string; labor: number; parts: number; duration: string; status: string }[]
  review: { rating: number; comment: string; public?: boolean } | null
  has_case: boolean
  online_enabled: boolean
  checkout_status: 'pending' | 'paid' | 'closed' | 'review_required' | null
  payment: { id: string; quote_id: string; amount: number; method: string; recorded_at: string } | null
}
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export async function api<T>(path: string, data?: object): Promise<T> {
  return apiMethod<T>(path,data===undefined?'GET':'POST',data)
}
export async function apiMethod<T>(path:string,method:'GET'|'POST'|'PUT'|'DELETE',data?:object):Promise<T> {
  const response = await fetch('/api' + path, { method,credentials:'include',...(data===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}) })
  const value = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, value?.message ?? 'Layanan sedang tidak tersedia. Coba lagi.')
  return value as T
}
export async function uploadPhoto(file:File):Promise<string> {
  const response=await fetch('/api/admin/uploads',{method:'POST',credentials:'include',headers:{'Content-Type':file.type},body:file})
  const value=await response.json().catch(()=>null)
  if(!response.ok) throw new ApiError(response.status,value?.message??'Foto belum dapat diunggah.')
  return String(value?.url??'')
}
export const money = (price: number) => new Intl.NumberFormat('id-ID',{ style:'currency', currency:'IDR', maximumFractionDigits:0 }).format(price)
export const date = (value: string) => new Intl.DateTimeFormat('id-ID',{ dateStyle:'medium', timeStyle:'short' }).format(new Date(value))
export const statuses: Record<string,string> = {
  submitted:'Permintaan masuk', accepted:'Toko menyetujui', received:'Perangkat diterima',
  diagnosis:'Diagnosis', quoted:'Menunggu persetujuan', approved:'Biaya disetujui',
  repairing:'Sedang diperbaiki', parts:'Menunggu suku cadang', ready:'Siap diambil',
  completed:'Selesai', cancelled:'Dibatalkan',
}
