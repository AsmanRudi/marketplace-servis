import { Router } from 'express'
import { z } from 'zod'
import { actor } from './auth'
import { technicianProfiles } from './db'
import { conflict, parse, words } from './http'

export const technicianRoutes = Router()
technicianRoutes.get('/profile',async (req,res) => {
  const user = await actor(req)
  const profile = await technicianProfiles.findOne({ _id:user.id },{ projection:{ _id:0,specialty:1,city:1,verified:1,created_at:1 } })
  res.json(profile)
})
technicianRoutes.post('/profile',async (req,res) => {
  const user = await actor(req)
  const input = parse(zodProfile,req.body)
  const result = await technicianProfiles.updateOne({ _id:user.id },{ $setOnInsert:{
    _id:user.id,...input,verified:false,created_at:new Date(),
  } },{ upsert:true })
  if (!result.upsertedCount && !(await technicianProfiles.findOne({ _id:user.id,verified:false }))) {
    throw conflict('Profil teknisi sudah terverifikasi. Hubungi dukungan jika datanya perlu diperbarui.')
  }
  res.status(result.upsertedCount ? 201 : 200).json({ id:user.id,verified:false })
})

const zodProfile = z.object({ specialty:words(2,100),city:words(2,80) })
