import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path ? 'nav-link active' : 'nav-link';
  const homePath = user?.role === 'ADMIN' ? '/admin' : '/courses';

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to={homePath} className="navbar-brand">
          <div className="navbar-brand-icon">🎓</div>
          <span className="navbar-brand-text">LearnHub</span>
        </Link>

        <div className="navbar-links">
          {user && (
            <>
              <Link to="/courses" className={isActive('/courses')}>Explore</Link>
              {user.role === 'STUDENT' && (
                <Link to="/my-courses" className={isActive('/my-courses')}>My Learning</Link>
              )}
              {user.role === 'TEACHER' && (
                <Link to="/create-course" className={isActive('/create-course')}>+ Course</Link>
              )}
              {user.role === 'ADMIN' && (
                <Link to="/admin" className={isActive('/admin')}>Admin Panel</Link>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {user ? (
            <>
              <div className="navbar-user">
                <div className="navbar-avatar">{initials}</div>
                <div>
                  <div className="navbar-username">{user.name}</div>
                  <div className="navbar-role">{user.role}</div>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleLogout}
                id="navbar-logout-btn"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
