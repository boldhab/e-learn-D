import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await login(email, password);
      navigate(result.user?.role === 'ADMIN' ? '/admin' : '/courses');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card animate-fadeUp">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">🎓</div>
          <div className="auth-title">Welcome Back</div>
          <div className="auth-subtitle">Sign in to continue learning</div>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form" id="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              className="form-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ marginTop: '0.5rem', width: '100%' }}
          >
            {loading ? (
              <>
                <span style={{ width:18,height:18,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',display:'inline-block',animation:'spin .7s linear infinite' }} />
                Signing in…
              </>
            ) : 'Sign In →'}
          </button>
        </form>

        <div className="auth-divider">
          Don't have an account?{' '}
          <Link to="/register">Create one free</Link>
        </div>

        {/* Demo hint */}
        <div style={{ marginTop:'1.5rem', padding:'1rem', background:'rgba(124,58,237,.08)', border:'1px solid rgba(124,58,237,.2)', borderRadius:'10px' }}>
          <div style={{ fontSize:'0.75rem', fontWeight:700, color:'#a78bfa', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'.5rem' }}>Demo Credentials</div>
          <div style={{ fontSize:'0.8rem', color:'#94a3b8', lineHeight:1.8 }}>
            👩‍🏫 Teacher: <code style={{ color:'#c4b5fd' }}>alice@teacher.com</code><br/>
            👨‍🎓 Student: <code style={{ color:'#c4b5fd' }}>bob@student.com</code><br/>
            🛡️ Admin: <code style={{ color:'#c4b5fd' }}>hab@admin.com</code><br/>
            🔑 Password: <code style={{ color:'#c4b5fd' }}>password123</code>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
