import { useState, useEffect } from 'react';

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ssoAvailable, setSsoAvailable] = useState(false);

  useEffect(() => {
    // Check if Azure SSO is configured on the backend
    fetch('/auth/azure/available')
      .then((r) => r.json())
      .then((data) => setSsoAvailable(!!data.available))
      .catch(() => setSsoAvailable(false));

    // Check if we were redirected back from Azure with an error
    const params = new URLSearchParams(window.location.search);
    const ssoError = params.get('sso_error');
    if (ssoError) {
      setError(`SSO sign-in failed: ${decodeURIComponent(ssoError)}`);
      // Clean the query param from the URL without a page reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (onLoginSuccess) {
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSsoLogin = () => {
    // Full-page navigation required — OIDC flow involves browser redirects to Microsoft
    window.location.href = '/auth/azure';
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src="/altera-logomark.svg" alt="Altera" className="login-logo" />
          <h1>Matcha SOW</h1>
          <p>Sign in to continue</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {ssoAvailable && (
          <>
            <div className="login-divider">
              <span>or</span>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-block"
              onClick={handleSsoLogin}
              disabled={loading}
            >
              <span style={{ marginRight: '0.5rem' }}>🏢</span>
              Sign in with Microsoft (SSO)
            </button>
          </>
        )}

        <div className="login-footer">
          <p>Contact your administrator for access.</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
