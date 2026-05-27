import { useState, useEffect, useCallback } from 'react';
import AccountManagement from './components/AccountManagement';
import ProductManagement from './components/ProductManagement';
import EngagementTypeManagement from './components/EngagementTypeManagement';
import TemplateManagement from './components/TemplateManagement';
import SOWGenerator from './components/SOWGenerator';
import SOWList from './components/SOWList';
import UserManagement from './components/UserManagement';
import UploadedSOWManagement from './components/UploadedSOWManagement';
import Dashboard from './components/Dashboard';
import ChangePassword from './components/ChangePassword';
import ScopeManagement from './components/ScopeManagement';
import PlaceholderLibrary from './components/PlaceholderLibrary';
import FixedSOWTemplates from './components/FixedSOWTemplates';
import Login from './components/Login';
import Register from './components/Register';
import './styles/App.css';

// ── Sidebar nav icons (inline SVGs — no icon-library dependency) ─────────────
const Icons = {
  Dashboard: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  Generate: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="M9.5 13.5l1.5 1.5 3.5-3.5"/>
    </svg>
  ),
  History: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Bank: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  Accounts: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Products: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    </svg>
  ),
  Engagements: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  Templates: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  FixedTemplates: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="M9 15l2 2 4-4"/>
    </svg>
  ),
  Scope: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  Placeholders: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Password: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  Logout: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  ChevronLeft: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
};

// ── Nav item definition (icon + label + view key) ─────────────────────────────
function buildNavItems(userRole, authProvider) {
  const items = [
    { view: 'dashboard',       label: 'Dashboard',          Icon: Icons.Dashboard,      group: 'main' },
    { view: 'generate',        label: 'Generate SOW',       Icon: Icons.Generate,       group: 'main' },
    { view: 'history',         label: 'SOW History',        Icon: Icons.History,        group: 'main' },
    { view: 'sow-bank',        label: 'SOW Knowledge Bank', Icon: Icons.Bank,           group: 'main' },
    { view: 'accounts',        label: 'Accounts',           Icon: Icons.Accounts,       group: 'data' },
    { view: 'products',        label: 'Products',           Icon: Icons.Products,       group: 'data' },
    { view: 'engagement-types',label: 'Engagement Types',   Icon: Icons.Engagements,    group: 'data' },
    { view: 'templates',       label: 'AI Templates',       Icon: Icons.Templates,      group: 'data' },
    { view: 'fixed-templates', label: 'Fixed SOW Templates',Icon: Icons.FixedTemplates, group: 'data' },
  ];
  if (userRole === 'admin') {
    items.push(
      { view: 'scope-management',   label: 'Scope Management',   Icon: Icons.Scope,        group: 'admin' },
      { view: 'placeholder-library',label: 'Placeholder Library', Icon: Icons.Placeholders, group: 'admin' },
      { view: 'users',              label: 'Manage Users',        Icon: Icons.Users,        group: 'admin' },
    );
  }
  if (authProvider !== 'azure') {
    items.push({ view: 'change-password', label: 'Change Password', Icon: Icons.Password, group: 'user' });
  }
  return items;
}

function App() {
  const [activeView, setActiveView] = useState('generate');
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('sidebarCollapsed') === 'true'
  );

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    // Detect a fresh post-SSO redirect (?sso=1) and strip the param from the URL
    const params = new URLSearchParams(window.location.search);
    const isPostSSO = params.get('sso') === '1';
    if (isPostSSO) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    checkAuthStatus(isPostSSO);
  }, []);

  const checkAuthStatus = async (retryOnce = false) => {
    let deferLoading = false; // true when we hand off setLoading to the retry closure
    try {
      const response = await fetch('/auth/session', { credentials: 'include' });
      const data = await response.json();

      if (data.authenticated && data.user) {
        setUser(data.user);
        setIsAuthenticated(true);
      } else if (retryOnce) {
        // After SSO redirect the SQLite session write might not have flushed
        // before this first request arrived.  Keep the loading spinner and
        // wait 800 ms before retrying.
        deferLoading = true;
        setTimeout(async () => {
          try {
            const r2 = await fetch('/auth/session', { credentials: 'include' });
            const d2 = await r2.json();
            if (d2.authenticated && d2.user) {
              setUser(d2.user);
              setIsAuthenticated(true);
            } else {
              setUser(null);
              setIsAuthenticated(false);
            }
          } catch {
            setUser(null);
            setIsAuthenticated(false);
          } finally {
            setLoading(false);
          }
        }, 800);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('Error checking auth status:', err);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      // Don't clear the loading flag when we have an active retry in-flight;
      // the retry's own finally block will do it.
      if (!deferLoading) setLoading(false);
    }
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    setShowRegister(false);
  };

  const handleLogout = async () => {
    try {
      await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
      setUser(null);
      setIsAuthenticated(false);
      setActiveView('generate');
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard />;
      case 'generate':
        return <SOWGenerator />;
      case 'history':
        return <SOWList />;
      case 'sow-bank':
        return <UploadedSOWManagement userRole={user?.role} />;
      case 'accounts':
        return <AccountManagement userRole={user?.role} />;
      case 'products':
        return <ProductManagement userRole={user?.role} />;
      case 'engagement-types':
        return <EngagementTypeManagement userRole={user?.role} />;
      case 'templates':
        return <TemplateManagement />;
      case 'users':
        return <UserManagement />;
      case 'change-password':
        if (user?.auth_provider === 'azure') return <SOWGenerator />;
        return <ChangePassword />;
      case 'scope-management':
        return <ScopeManagement />;
      case 'placeholder-library':
        return <PlaceholderLibrary userRole={user?.role} />;
      case 'fixed-templates':
        return <FixedSOWTemplates userRole={user?.role} />;
      default:
        return <SOWGenerator />;
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Show login/register if not authenticated
  if (!isAuthenticated) {
    if (showRegister) {
      return (
        <Register
          onRegisterSuccess={handleLoginSuccess}
          onSwitchToLogin={() => setShowRegister(false)}
        />
      );
    }
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Show main application if authenticated
  const navItems = buildNavItems(user.role, user?.auth_provider);
  const collapsed = sidebarCollapsed;

  return (
    <div className={`app ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>

        {/* ── Brand header (logo + title + collapse toggle) ───────── */}
        <div className="sidebar-brand">
          <img src="/altera-graphicmark-rev.svg" alt="Altera" className="sidebar-logo" />
          {!collapsed && (
            <div className="sidebar-brand-text">
              <span className="sidebar-title">Matcha SOW</span>
              <span className="sidebar-subtitle">Statement of Work</span>
            </div>
          )}
          <button
            className="sidebar-toggle"
            onClick={toggleSidebar}
            title={collapsed ? 'Expand menu' : 'Collapse menu'}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          >
            {collapsed ? <Icons.ChevronRight /> : <Icons.ChevronLeft />}
          </button>
        </div>

        {/* ── User info + logout (always visible at top) ──────────── */}
        <div className={`sidebar-user ${collapsed ? 'collapsed' : ''}`}>
          <div className="user-avatar" title={collapsed ? (user.display_name || user.username) : undefined}>
            {(user.display_name?.[0] || user.username?.[0] || '?')}
          </div>
          {!collapsed && (
            <div className="user-details">
              <div className="user-name">{user.display_name || user.username}</div>
              <div className="user-role">{user.role}</div>
            </div>
          )}
          <button
            className="sidebar-logout-btn"
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
            data-tooltip="Logout"
          >
            <Icons.Logout />
          </button>
        </div>

        {/* ── Navigation ────────────────────────────────────────── */}
        <nav className="sidebar-nav">
          {navItems.map((item, idx) => {
            const prevGroup = idx > 0 ? navItems[idx - 1].group : item.group;
            const showDivider = idx > 0 && item.group !== prevGroup;
            return (
              <div key={item.view}>
                {showDivider && <div className="nav-divider" />}
                <button
                  className={`nav-item ${activeView === item.view ? 'active' : ''}`}
                  onClick={() => setActiveView(item.view)}
                  title={collapsed ? item.label : undefined}
                  data-tooltip={item.label}
                >
                  <span className="nav-icon"><item.Icon /></span>
                  {!collapsed && <span className="nav-label">{item.label}</span>}
                </button>
              </div>
            );
          })}
        </nav>

      </aside>
      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
