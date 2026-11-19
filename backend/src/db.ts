import { MongoClient } from 'mongodb'
import { loadEnvFile } from 'node:process'

try { loadEnvFile() } catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
}
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'
export const client = new MongoClient(uri,{ serverSelectionTimeoutMS:5000 })
const db = client.db(process.env.MONGODB_DB || 'meja_servis')

export type User = { _id: string; name: string; email: string; password: string; platform_admin: boolean; disabled?:boolean; created_at?:Date; photo_url?:string|null }
export type TechnicianProfile = { _id:string; specialty:string; city:string; verified:boolean; created_at:Date; photo_url?:string|null }
export type Member = { user_id: string; name: string; role: 'manager'|'technician'; specialty?: string }
export type Service = { id: string; name: string; device: 'HP'|'Laptop'; starting_price: number; warranty_days: number }
export type Shop = {
  _id: string; name: string; city: string; district: string; description: string; dropoff_address: string | null;
  verified: boolean; created_at: Date; members: Member[]; services: Service[];
  photo_url?: string | null; location?: { type:'Point'; coordinates:[number,number] } | null; demo?: boolean;
}
export type Quote = {
  id: string; diagnosis: string; labor: number; parts: number; duration: string;
  status: 'pending'|'approved'|'rejected'|'superseded'; created_at: Date;
}
export type Checkout = {
  provider_order_id: string; quote_id: string; amount: number;
  status: 'pending'|'paid'|'closed'|'review_required'; redirect_url: string | null;
}
export type Payment = { id: string; quote_id: string; recorded_by: string | null; amount: number; method: string; recorded_at: Date }
export type ServiceCase = {
  kind:'complaint'|'warranty'; status:'open'|'in_review'|'resolved'; created_at:Date; updated_at:Date
  messages:{ role:'customer'|'manager'|'admin'; message:string; created_at:Date }[]
}
export type Ticket = {
  _id: string; revision: number; shop_id: string; shop_name: string; service_id: string; service_name: string; device: string;
  customer_id: string; preferred_id: string | null; technician_id: string | null; technician_name: string | null;
  device_model: string; complaint: string; condition: string | null; status: string; warranty_days: number;
  completed_at: Date | null; created_at: Date; quotes: Quote[];
  events: { actor_id: string; status: string; note: string | null; created_at: Date }[];
  service_case?: ServiceCase; review: { rating: number; comment: string; public?: boolean; created_at?: Date } | null; payment: Payment | null; checkout: Checkout | null;
}
export type Product = {
  _id:string; shop_id:string; name:string; category:'phone'|'laptop'|'phone_accessory'|'laptop_accessory';
  condition:'new'|'used'; description:string; price:number; stock:number; warranty_days:number;
  photo_url:string|null; condition_notes:string|null; inspection_notes?:string|null; created_at:Date; published:boolean;
}
export const products = db.collection<Product>('products')
export const users = db.collection<User>('users')
export const technicianProfiles = db.collection<TechnicianProfile>('technician_profiles')
export const shops = db.collection<Shop>('shops')
export const tickets = db.collection<Ticket>('tickets')
export const notificationReads = db.collection<{ _id: string; read_at: Date }>('notification_reads')
export const sessions = db.collection<{ _id: string; user_id: string; expires_at: Date }>('sessions')
export async function init() {
  await client.connect()
  await Promise.all([
    users.createIndex({ email:1 },{ unique:true }),
    technicianProfiles.createIndex({ verified:1,created_at:-1 }),
    shops.createIndex({ 'members.user_id':1 }),
    shops.createIndex({ verified:1,name:1 }),
    products.createIndex({ published:1,created_at:-1 }),
    products.createIndex({ shop_id:1,created_at:-1 }),
    tickets.createIndex({ customer_id:1,created_at:-1 }),
    tickets.createIndex({ shop_id:1,created_at:-1 }),
    tickets.createIndex({ technician_id:1,created_at:-1 }),
    tickets.createIndex({ 'checkout.provider_order_id':1 },{ unique:true,partialFilterExpression:{ 'checkout.provider_order_id':{ $type:'string' } } }),
    sessions.createIndex({ expires_at:1 },{ expireAfterSeconds:0 }),
  ])
}

