import { useState } from 'react'
import { api } from '../api'
import { ActionForm, field } from '../components/ActionForm'

export function LoginPrompt({ title, loading, onClick }: { title: string; loading: boolean; onClick: () => void }) {
  return <section className="wrap page narrow login-prompt"><span className="login-eyebrow">MEJA SERVIS · RUANG PELANGGAN</span><h1>{title}</h1>{loading ? <p role="status">Memeriksa sesiâ€¦</p> : <><p>Masuk untuk melihat perjalanan servis, pembaruan dari toko, dan riwayat perangkatmu.</p><button onClick={onClick} className="button">Masuk ke akun <span aria-hidden="true">→</span></button></>}</section>
}
export function SignIn({ onDone, adminOnly = false }: { onDone: () => Promise<void>; adminOnly?: boolean }) {
  const [register,setRegister] = useState(false)
  return <section className={'wrap page login-page'+(adminOnly ? ' login-admin' : '')}>
    <div className="login-card">
      <aside className="login-aside">
        <a className="brand login-brand" href="/" aria-label="Meja Servis, beranda"><span className="mark" aria-hidden="true"><i/><i/><i/></span>meja<span>servis</span></a>
        <div className="login-aside-copy">
          <span className="login-eyebrow">{adminOnly ? 'RUANG ADMIN' : 'SERVIS LEBIH TERPANTAU'}</span>
          <h2>{adminOnly ? 'Kelola platform dengan tenang.' : 'Semua kabar servis, ada di satu tempat.'}</h2>
          <p>{adminOnly ? 'Masuk untuk meninjau operasional dan verifikasi mitra.' : 'Lacak progres, cek penawaran, dan simpan riwayat servis perangkatmu.'}</p>
        </div>
        {!adminOnly && <div className="login-aside-note"><span className="login-spark" aria-hidden="true">✳</span><p><strong>Lebih jelas dari awal.</strong><br/>Biaya, progres, dan catatan servis mudah ditemukan kembali.</p></div>}
        <span className="login-decor login-decor-one" aria-hidden="true"/><span className="login-decor login-decor-two" aria-hidden="true"/>
      </aside>
      <div className="login-form-side">
        <div className="login-form-heading">
          <span className="login-eyebrow">{adminOnly ? 'AKSES TERBATAS' : register ? 'MULAI DI SINI' : 'SENANG MELIHATMU KEMBALI'}</span>
          <h1>{adminOnly ? 'Masuk sebagai admin' : register ? 'Buat akun baru' : 'Masuk ke akun'}</h1>
          <p>{adminOnly ? 'Gunakan akun admin platform yang terdaftar.' : register ? 'Buat akun untuk mulai mengelola servis dan pesananmu.' : 'Masukkan detail akun untuk melanjutkan.'}</p>
        </div>
        <ActionForm key={String(register)} label={register ? 'Buat akun' : 'Masuk'} className="login-form" onSend={async form => {
          const email = field(form,'email'), password = field(form,'password')
          await api('/auth/' + (register ? 'register' : 'login'), register ? { email,password,name:field(form,'name') } : { email,password })
          await onDone()
        }}>
          {register && <label>Nama<input name="name" autoComplete="name" minLength={2} maxLength={100} placeholder="Nama lengkap" required/></label>}
          <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} placeholder="nama@email.com" required/></label>
          <label>Kata sandi<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={10} maxLength={128} placeholder="Minimal 10 karakter" required/></label>
        </ActionForm>
        {!adminOnly && <p className="login-switch">{register ? 'Sudah punya akun?' : 'Belum punya akun?'} <button className="link" onClick={() => setRegister(!register)}>{register ? 'Masuk di sini' : 'Daftar sekarang'}</button></p>}
        <p className="login-privacy">Dengan masuk, akunmu tetap aman dan hanya dapat melihat data milikmu.</p>
      </div>
    </div>
  </section>
}
