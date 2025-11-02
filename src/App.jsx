import { useState, useEffect } from 'react';
import AccountManagement from './components/AccountManagement';
import ProductManagement from './components/ProductManagement';
import EngagementTypeManagement from './components/EngagementTypeManagement';
import TemplateManagement from './components/TemplateManagement';
import SOWGenerator from './components/SOWGenerator';
import SOWList from './components/SOWList';
import UserManagement from './components/UserManagement';
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
      const response = await fetch('/auth/session');
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
      await fetch('/auth/logout', { method: 'POST' });
      setUser(null);
      setIsAuthenticated(false);
      setActiveView('generate');
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  const renderContent = () => {
    switch (activeView) {
      case 'generate':
        return <SOWGenerator />;
      case 'history':
        return <SOWList />;
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
            <div
              className={`nav-item ${activeView === 'users' ? 'active' : ''}`}
              onClick={() => setActiveView('users')}
            >
              Manage Users
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <button className="btn btn-outline btn-block" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>
      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
