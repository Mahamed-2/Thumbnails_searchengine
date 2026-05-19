// src/components/Layout.tsx — Main app shell with sidebar nav
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Image, BarChart3, Settings, Zap } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/collection', label: 'Collect', icon: Zap },
  { to: '/dataset', label: 'Dataset', icon: Image },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <nav style={{
        width: '240px',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        padding: '1.5rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        overflowY: 'auto',
      }}>
        <div style={{ padding: '0 0.5rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 800 }} className="gradient-text">
            🎮 Roblox Dataset
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Thumbnail Collection Tool
          </p>
        </div>

        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.625rem 0.75rem',
              borderRadius: 'var(--radius)',
              textDecoration: 'none',
              fontSize: '0.9375rem',
              fontWeight: 500,
              transition: 'all var(--transition-fast)',
              background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: isActive ? 'var(--primary-300)' : 'var(--text-secondary)',
              border: isActive ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid transparent',
            })}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}

        <div style={{ marginTop: 'auto', padding: '1rem 0.5rem 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.625rem' }} className="badge badge-success">LIVE</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>v1.0.0-alpha</span>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ marginLeft: '240px', flex: 1, padding: '2rem', maxWidth: 'calc(100vw - 240px)' }}>
        <Outlet />
      </main>
    </div>
  );
}
