import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STUDENT');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(name, email, password, role);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card animate-fadeUp">
        <div className="auth-logo">
          <div className="auth-logo-icon">🚀</div>
          <div className="auth-title">Create Account</div>
          <div className="auth-subtitle">Start your learning journey today</div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" id="register-form">
          <div className="form-group">
            <label className="form-label" htmlFor="register-name">Full Name</label>
            <input
              id="register-name"
              className="form-input"
              type="text"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-email">Email Address</label>
            <input
              id="register-email"
              className="form-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-password">Password</label>
            <input
              id="register-password"
              className="form-input"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">I am a…</label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {['STUDENT', 'TEACHER'].map((r) => (
                <label
                  key={r}
                  htmlFor={`role-${r}`}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '0.85rem 1rem',
                    borderRadius: '10px',
                    border: `1px solid ${role === r ? 'rgba(124,58,237,.6)' : 'rgba(255,255,255,.08)'}`,
                    background: role === r ? 'rgba(124,58,237,.12)' : 'rgba(255,255,255,.04)',
                    cursor: 'pointer',
                    transition: 'all .2s',
                    userSelect: 'none',
                  }}
                >
                  <input
                    id={`role-${r}`}
                    type="radio"
                    name="role"
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                    style={{ accentColor: '#7c3aed' }}
                  />
                  <span style={{ fontSize: '1.2rem' }}>{r === 'STUDENT' ? '👨‍🎓' : '👩‍🏫'}</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: role === r ? '#c4b5fd' : '#94a3b8' }}>
                    {r === 'STUDENT' ? 'Student' : 'Teacher'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button
            id="register-submit-btn"
            type="submit"
            className="btn btn-success btn-lg"
            disabled={loading}
            style={{ marginTop: '0.5rem', width: '100%' }}
          >
            {loading ? (
              <>
                <span style={{ width:18,height:18,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',display:'inline-block',animation:'spin .7s linear infinite' }} />
                Creating account…
              </>
            ) : 'Create Account →'}
          </button>
        </form>

        <div className="auth-divider">
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
