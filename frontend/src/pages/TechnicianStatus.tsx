import { useEffect, useState } from 'react'
import { api, date } from '../api'

type Profile={ specialty:string;city:string;verified:boolean;created_at:string }
export function TechnicianStatus() {
  const [profile,setProfile]=useState<Profile|null|undefined>(undefined)
  const [error,setError]=useState('')
  useEffect(()=>{let active=true;void api<Profile|null>('/technicians/profile').then(value=>{if(active)setProfile(value)},failure=>{if(active)setError(failure instanceof Error?failure.message:'Status pengajuan belum dapat dimuat.')});return()=>{active=false}},[])
  return <section className="wrap page narrow technician-status-page">
    <a className="back" href="/">← Kembali ke beranda</a>
    <div className="admin-card technician-status-card"><span className="login-eyebrow">TEKNISI PERORANGAN</span><h1>Status pengajuan</h1>
      {error?<p className="error" role="alert">{error}</p>:profile===undefined?<p role="status">Memeriksa status profil…</p>:!profile?<><p>Belum ada pengajuan teknisi pada akun ini.</p><a className="button" href="/?halaman=masuk">Ajukan profil teknisi</a></>:<>
        <span className={'admin-product-state'+(profile.verified?' is-visible':'')}>{profile.verified?'Profil disetujui':'Menunggu tinjauan admin'}</span>
        <dl className="technician-status-details"><dt>Keahlian</dt><dd>{profile.specialty}</dd><dt>Kota</dt><dd>{profile.city}</dd><dt>Diajukan</dt><dd>{date(profile.created_at)}</dd></dl>
        <p className="muted">{profile.verified?'Profilmu telah disetujui. Untuk menerima tiket servis, teknisi perlu bergabung dengan toko mitra agar penugasan dan akses tiket tetap terkelola.':'Admin akan memeriksa profilmu. Setelah disetujui, kamu dapat menghubungi toko mitra untuk bergabung dan menerima penugasan.'}</p>
      </>}
    </div>
  </section>
}
