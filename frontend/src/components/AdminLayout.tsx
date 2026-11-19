import { useState, type ReactNode } from 'react'

export function AdminLayout({ children, authorized, section, onLogout }: {
  children:ReactNode; authorized:boolean; section:'dashboard'|'cases'|'tickets'|'products'|'users'|'shops'|'technicians'; onLogout:() => Promise<void>
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  return <div className="admin-shell">
    <a className="skip" href="#admin-content">Lewati ke konten admin</a>
    <aside className="admin-sidebar">
      <div className="admin-mobile-header">
        <a className="admin-brand" href={authorized ? '/admin' : '/'}>Meja Servis <span>ADMIN</span></a>
        <button className="admin-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? 'Tutup ×' : 'Menu ☰'}</button>
      </div>
      <div id="admin-navigation" className="admin-navigation" data-open={menuOpen} onKeyDown={event => { if (event.key === 'Escape') { setMenuOpen(false); document.querySelector<HTMLButtonElement>('.admin-menu-toggle')?.focus() } }}>
      {authorized && <nav aria-label="Navigasi admin" onClick={() => setMenuOpen(false)}>
        <span className="admin-nav-label">RINGKASAN</span>
        <a href="/admin" aria-current={section === 'dashboard' ? 'page' : undefined}><span className="admin-nav-icon" aria-hidden="true">⌂</span>Dashboard</a>
        <span className="admin-nav-label">OPERASIONAL</span>
        <a href="/admin#verifikasi-toko"><span className="admin-nav-icon" aria-hidden="true">✓</span>Verifikasi toko</a>
        <a href="/admin/tiket" aria-current={section === 'tickets' ? 'page' : undefined}><span className="admin-nav-icon" aria-hidden="true">▤</span>Tiket servis</a>
        <a href="/admin/kasus" aria-current={section === 'cases' ? 'page' : undefined}><span className="admin-nav-icon" aria-hidden="true">◇</span>Kasus servis</a>
        <span className="admin-nav-label">AKUN & MITRA</span>
        <a href="/admin/pengguna" aria-current={section === 'users' ? 'page' : undefined}><span className="admin-nav-icon" aria-hidden="true">◎</span>Kelola pengguna</a>
        <a href="/admin/toko" aria-current={section === 'shops' ? 'page' : undefined}><span className="admin-nav-icon" aria-hidden="true">⌂</span>Kelola toko</a>
        <a href="/admin/teknisi" aria-current={section === 'technicians' ? 'page' : undefined}><span className="admin-nav-icon" aria-hidden="true">⚙</span>Kelola teknisi</a>
        <span className="admin-nav-label">KATALOG</span>
        <a href="/admin/produk" aria-current={section === 'products' ? 'page' : undefined}><span className="admin-nav-icon" aria-hidden="true">▧</span>Kelola produk</a>
      </nav>}
      <div className="admin-sidebar-actions">
        <a href="/">Lihat situs Meja Servis ↗</a>
        {authorized && <button type="button" onClick={() => void onLogout()}>Keluar</button>}
      </div>
      </div>
    </aside>
    <main id="admin-content" tabIndex={-1} className="admin-content">{children}</main>
  </div>
}
