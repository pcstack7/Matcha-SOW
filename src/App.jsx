import { useState } from 'react';
import AccountManagement from './components/AccountManagement';
import TemplateManagement from './components/TemplateManagement';
import SOWGenerator from './components/SOWGenerator';
import SOWList from './components/SOWList';
import './styles/App.css';

function App() {
  const [activeView, setActiveView] = useState('generate');

  const renderContent = () => {
    switch (activeView) {
      case 'generate':
        return <SOWGenerator />;
      case 'history':
        return <SOWList />;
      case 'accounts':
        return <AccountManagement />;
      case 'templates':
        return <TemplateManagement />;
      default:
        return <SOWGenerator />;
    }
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Matcha SOW</h1>
          <p>Statement of Work Generator</p>
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
            Manage Accounts
          </div>
          <div
            className={`nav-item ${activeView === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveView('templates')}
          >
            Manage Templates
          </div>
        </nav>
      </aside>
      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
