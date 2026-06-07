import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path ? 'nav-link active' : 'nav-link';
  const homePath = user?.role === 'ADMIN' ? '/admin' : '/courses';
  const navigationItems = {
    STUDENT: [
      { label: 'Courses', path: '/courses' },
      { label: 'My Courses', path: '/my-courses' },
      { label: 'Dashboard', path: '/profile' },
    ],
    TEACHER: [
      { label: 'Courses', path: '/courses' },
      { label: 'My Courses', path: '/my-courses' },
      { label: 'Create Course', path: '/create-course' },
    ],
    ADMIN: [
      { label: 'Admin Panel', path: '/admin' },
    ],
  };

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
          {user && (navigationItems[user.role] || []).map((item) => (
            <Link key={item.path} to={item.path} className={isActive(item.path)}>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="navbar-actions">
          <button
            type="button"
            className="icon-button"
            onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>

          {user ? (
            <div className="profile-menu" ref={dropdownRef}>
              <button
                type="button"
                className="navbar-user"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <div className="navbar-avatar">{initials}</div>
                <div>
                  <div className="navbar-username">{user.name}</div>
                  <div className="navbar-role">{user.role}</div>
                </div>
              </button>

              {menuOpen && (
                <div className="profile-dropdown" role="menu">
                  <div className="profile-dropdown-header">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                    <span className="badge badge-purple">{user.role}</span>
                  </div>
                  <Link to="/profile" className="profile-dropdown-item" onClick={() => setMenuOpen(false)}>
                    Profile
                  </Link>
                  <button
                    className="profile-dropdown-item danger"
                    onClick={handleLogout}
                    id="navbar-logout-btn"
                    type="button"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
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
