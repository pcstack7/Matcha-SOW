import { useState, useEffect } from 'react';
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
import Login from './components/Login';
import Register from './components/Register';
import './styles/App.css';

function App() {
  const [activeView, setActiveView] = useState('generate');
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/auth/session', { credentials: 'include' });
      const data = await response.json();

      if (data.authenticated && data.user) {
        setUser(data.user);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('Error checking auth status:', err);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
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
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-header-top">
            <img src="/altera-graphicmark-rev.svg" alt="Altera" className="sidebar-graphicmark" />
            <button className="logout-icon-btn" onClick={handleLogout} title="Logout">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
          <h1>Matcha SOW</h1>
          <p>Statement of Work Generator</p>
        </div>

        <div className="user-info">
          <div className="user-avatar">{user.display_name?.[0] || user.username[0]}</div>
          <div className="user-details">
            <div className="user-name">{user.display_name || user.username}</div>
            <div className="user-role">{user.role}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div
            className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveView('dashboard')}
          >
            Dashboard
          </div>
          <div
            className={`nav-item ${activeView === 'generate' ? 'active' : ''}`}
            onClick={() => setActiveView('generate')}
          >
            Generate SOW
          </div>
          <div
            className={`nav-item ${activeView === 'history' ? 'active' : ''}`}
            onClick={() => setActiveView('history')}
          >
            SOW History
          </div>
          <div
            className={`nav-item ${activeView === 'sow-bank' ? 'active' : ''}`}
            onClick={() => setActiveView('sow-bank')}
          >
            SOW Knowledge Bank
          </div>
          <div
            className={`nav-item ${activeView === 'accounts' ? 'active' : ''}`}
            onClick={() => setActiveView('accounts')}
          >
            Accounts Master
          </div>
          <div
            className={`nav-item ${activeView === 'products' ? 'active' : ''}`}
            onClick={() => setActiveView('products')}
          >
            Products Master
          </div>
          <div
            className={`nav-item ${activeView === 'engagement-types' ? 'active' : ''}`}
            onClick={() => setActiveView('engagement-types')}
          >
            Engagement Types
          </div>
          <div
            className={`nav-item ${activeView === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveView('templates')}
          >
            Manage Templates
          </div>
          {user.role === 'admin' && (
            <>
              <div
                className={`nav-item ${activeView === 'scope-management' ? 'active' : ''}`}
                onClick={() => setActiveView('scope-management')}
              >
                Scope Management
              </div>
              <div
                className={`nav-item ${activeView === 'users' ? 'active' : ''}`}
                onClick={() => setActiveView('users')}
              >
                Manage Users
              </div>
            </>
          )}
          {user?.auth_provider !== 'azure' && (
            <div
              className={`nav-item ${activeView === 'change-password' ? 'active' : ''}`}
              onClick={() => setActiveView('change-password')}
            >
              Change Password
            </div>
          )}
        </nav>

      </aside>
      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
