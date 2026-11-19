import { useEffect, useState } from 'react'
import { api, type Account, type Shop } from './api'
import { Home } from './pages/Home'
import { Directory, Booking } from './pages/Booking'
import { LoginPrompt, SignIn } from './pages/SignIn'
import { Tickets } from './pages/Tickets'
import { Cart, ProductDetail } from './pages/Purchase'
import { Products } from './pages/Products'
import { Cases } from './pages/Cases'
import { Notifications } from './pages/Notifications'
import { Admin } from './pages/Admin'
import { AdminLayout } from './components/AdminLayout'
import { Workspace } from './pages/Workspace'

type Page = 'beranda' | 'toko' | 'servis' | 'mitra' | 'masuk' | 'pesan' | 'notifikasi' | 'kasus' | 'produk' | 'detail-produk' | 'keranjang' | 'admin' | 'workbench'
const pages: Page[] = ['beranda','toko','servis','mitra','masuk','pesan','notifikasi','kasus','produk','detail-produk','keranjang','admin','workbench']
export function readPage(): Page {
  if (/^\/admin(?:\/kasus)?\/?$/.test(location.pathname)) return 'admin'
  const hash = new URLSearchParams(location.search).get('halaman') as Page
  return pages.includes(hash) ? hash : 'beranda'
}
const go = (page: Page) => {
  if (page === readPage()) return
  history.pushState(null, '', page === 'admin' ? '/admin' : page === 'beranda' ? '/' : '/?halaman=' + page)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
export function App() {
  const [page,setPage] = useState(readPage)
  const [menuOpen,setMenuOpen] = useState(false)
  const [account,setAccount] = useState<Account | null | undefined>(undefined)
  const [notice,setNotice] = useState('')
  const [shops,setShops] = useState<Shop[]>([])
  const [catalog,setCatalog] = useState<'loading'|'ready'|'error'>('loading')
  const [selected,setSelected] = useState<Shop | null>(null)
  const [ticket,setTicket] = useState('')
  const [next,setNext] = useState<Page | null>(null)
  async function refreshAccount() {
    try {
      const current = await api<Account | null>('/auth/me')
      setAccount(current)
      setNotice('')
      return current
    }
    catch {
      setAccount(null)
      setNotice('Koneksi ke layanan belum tersedia.')
      return null
    }
  }
  function loadShops() {
    setCatalog('loading')
    void api<Shop[]>('/shops').then(value => { setShops(value); setCatalog('ready') },() => setCatalog('error'))
  }
  useEffect(() => {
    const onNavigate = () => { setPage(readPage()); setMenuOpen(false); if (!location.hash) window.scrollTo(0,0) }
    if (readPage() === 'admin' && location.pathname === '/') history.replaceState(null,'','/admin'+location.hash)
    window.addEventListener('popstate',onNavigate)
    void refreshAccount()
    loadShops()
    return () => window.removeEventListener('popstate',onNavigate)
  },[])
  function requireAccount(target: Page) {
    if (!account) { setNext(target); go('masuk') }
    else go(target)
  }
  async function logout() {
    try { await api('/auth/logout',{}); setAccount(null); setTicket(''); go('beranda') }
    catch { setNotice('Gagal keluar. Coba lagi.') }
  }
  if (page === 'admin') {
    const isCases = /^\/admin\/kasus\/?$/.test(location.pathname)
    return <AdminLayout authorized={account?.platform_admin === true} cases={isCases} onLogout={logout}>
      {notice && <p className="wrap error" role="status">{notice}</p>}
      {account?.platform_admin ? (isCases ? <Cases admin/> : <Admin/>)
        : account === undefined ? <p className="wrap page" role="status">Memeriksa sesi admin…</p>
        : account ? <section className="wrap page narrow"><h1>Dashboard admin</h1>
          <p>Akun ini tidak memiliki akses admin.</p><a className="button" href="/">Kembali ke beranda</a></section>
        : <SignIn adminOnly onDone={async () => {
          const current = await refreshAccount()
          if (!current) throw new Error('Sesi masuk belum dapat diverifikasi.')
        }}/>
      }
    </AdminLayout>
  }
  return <>
    <a className="skip" href="#content" onClick={event => { event.preventDefault(); document.getElementById('content')?.focus() }}>Lewati ke konten</a>
    <header className="site-header"><div className="wrap nav" onKeyDown={event => { if (event.key === 'Escape') { setMenuOpen(false); document.querySelector<HTMLButtonElement>('.site-menu-toggle')?.focus() } }}>
      <a className="brand" href="/" aria-label="Meja Servis, beranda"><span className="mark" aria-hidden="true"><i/><i/><i/></span>meja<span>servis</span></a>
      <button type="button" className="site-menu-toggle" aria-expanded={menuOpen} aria-controls="site-navigation" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? 'Tutup ×' : 'Menu ☰'}</button>
      <div id="site-navigation" className="site-navigation" data-open={menuOpen}>
      <nav aria-label="Navigasi utama" onClick={() => setMenuOpen(false)}>
        <a href="?halaman=toko" className={page === 'toko' || page === 'pesan' ? 'nav-active' : undefined} aria-current={page === 'toko' ? 'page' : undefined}>Cari servis</a>
        <a href="?halaman=servis" className={['servis','notifikasi','kasus','workbench'].includes(page) ? 'nav-active' : undefined} aria-current={page === 'servis' ? 'page' : undefined}>Lacak servis</a>
        <a href="?halaman=produk" className={['produk','detail-produk','keranjang'].includes(page) ? 'nav-active' : undefined} aria-current={['produk','detail-produk','keranjang'].includes(page) ? 'page' : undefined}>Produk</a>
        <a href="?halaman=mitra" className={page === 'mitra' ? 'nav-active' : undefined} aria-current={page === 'mitra' ? 'page' : undefined}>Mitra toko</a>
        {account?.platform_admin && <a href="/admin">Admin ↗</a>}
      </nav>
      {account ? <button className="nav-account" onClick={() => void logout()}>Keluar <span aria-hidden="true">↗</span></button> : <a className="nav-account" href="?halaman=masuk">Masuk <span aria-hidden="true">↗</span></a>}
      </div>
    </div></header>
    <main id="content" tabIndex={-1}>
      {notice && page !== 'beranda' && <p className="wrap error" role="status">{notice}</p>}
      {page === 'beranda' && <Home shops={shops}/>}
      {page === 'toko' && <Directory shops={shops} state={catalog} reload={loadShops} select={shop => { setSelected(shop); go('pesan') }}/>}
      {page === 'pesan' && (selected
        ? <Booking shop={selected} account={account} signIn={() => requireAccount('pesan')} onCreated={id => { setTicket(id); go('servis') }}/>
        : <div className="wrap page"><h1>Pilih toko servis</h1><a className="button" href="?halaman=toko">Lihat daftar toko</a></div>)}
      {page === 'masuk' && <SignIn onDone={async () => {
        const current = await refreshAccount()
        if (!current) throw new Error('Sesi masuk belum dapat diverifikasi.')
        go(next ?? (current.platform_admin ? 'admin' : 'servis'))
        setNext(null)
      }}/>}
      {page === 'servis' && (account
        ? <Tickets account={account} ticket={ticket} setTicket={setTicket}/>
        : <LoginPrompt title="Lacak servis" loading={account === undefined} onClick={() => requireAccount('servis')}/>)}
      {page === 'workbench' && (account?.memberships.some(member => member.role === 'technician')
        ? <Tickets account={account} ticket={ticket} setTicket={setTicket} workbench/>
        : account
          ? <section className="wrap page narrow"><h1>Meja kerja teknisi</h1><p>Halaman ini tersedia untuk teknisi terdaftar.</p></section>
          : <LoginPrompt title="Meja kerja teknisi" loading={account === undefined} onClick={() => requireAccount('workbench')}/>)}
      {page === 'notifikasi' && (account
        ? <Notifications openTicket={id => { setTicket(id); go('servis') }}/>
        : <LoginPrompt title="Notifikasi servis" loading={account === undefined} onClick={() => requireAccount('notifikasi')}/>)}
      {page === 'produk' && <Products/>}
      {page === 'detail-produk' && <ProductDetail/>}
      {page === 'keranjang' && <Cart/>}
      {page === 'kasus' && (account
        ? <Cases/>
        : <LoginPrompt title="Kasus servis" loading={account === undefined} onClick={() => requireAccount('kasus')}/>)}
      {page === 'mitra' && (account
        ? <Workspace account={account} onChange={() => { loadShops(); void refreshAccount() }}/>
        : <LoginPrompt title="Ruang mitra toko" loading={account === undefined} onClick={() => requireAccount('mitra')}/>)}
    </main>
    <footer className="closing"><div className="wrap footer"><a className="brand" href="/">meja<span>servis</span></a>
      <div className="footer-links"><a href="?halaman=toko">Cari toko servis</a><a href="?halaman=servis">Lacak servis</a><a href="?halaman=produk">Katalog produk</a></div>
      <small>Ilustrasi servis dan toko dibuat Oleh Rudi Asman Salim</small>

    </div></footer>
  </>
}
