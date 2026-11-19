import { Router } from 'express'
import { actor } from './auth'
import { shops, tickets, type Shop, type Ticket } from './db'
import { forbidden } from './http'

export const adminRoutes = Router()
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

