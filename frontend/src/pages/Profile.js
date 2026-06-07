import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI, courseAPI, learningAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const formatDate = (value) => {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const StatCard = ({ label, value }) => (
  <div className="stat-card">
    <div className="stat-value">{value ?? 0}</div>
    <div className="stat-label">{label}</div>
  </div>
);

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState({ name: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      try {
        const profileRes = await authAPI.getProfile(user.id);
        setProfile(profileRes.data);
        setForm({ name: profileRes.data.name, email: profileRes.data.email });

        if (user.role === 'STUDENT') {
          const dashboardRes = await learningAPI.getDashboard(user.id);
          setStats(dashboardRes.data);
        } else if (user.role === 'TEACHER') {
          const teacherRes = await courseAPI.getTeacherStats(user.id);
          setStats(teacherRes.data);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load profile');
      }
    };

    loadProfile();
  }, [user]);

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      const res = await authAPI.updateProfile(form);
      setProfile(res.data);
      updateUser(res.data);
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      await authAPI.changePassword(passwordForm);
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
      setMessage('Password changed successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    }
  };

  if (!profile) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span>Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="page-wrapper animate-fadeUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">Manage your account and learning activity</p>
        </div>
      </div>

      {message && <div className="alert alert-success" style={{ marginBottom:'1.5rem' }}>{message}</div>}
      {error && <div className="alert alert-error" style={{ marginBottom:'1.5rem' }}>{error}</div>}

      <div className="profile-layout">
        <div className="section-card">
          <div className="profile-summary">
            <div className="profile-avatar-large">
              {profile.name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div>
              <h2>{profile.name}</h2>
              <p>{profile.email}</p>
              <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap', marginTop:'.75rem' }}>
                <span className="badge badge-purple">{profile.role}</span>
                <span className="badge badge-teal">Member since {formatDate(profile.created_at)}</span>
              </div>
            </div>
          </div>

          <div className="stats-grid">
            {profile.role === 'STUDENT' && (
              <>
                <StatCard label="Courses Enrolled" value={stats?.total_courses_enrolled} />
                <StatCard label="Completed Courses" value={stats?.completed_courses} />
                <StatCard label="Average Progress" value={`${stats?.average_progress || 0}%`} />
              </>
            )}
            {profile.role === 'TEACHER' && (
              <>
                <StatCard label="Courses Created" value={stats?.total_courses_created} />
                <StatCard label="Students Enrolled" value={stats?.total_students_enrolled} />
                <StatCard label="Lessons" value={stats?.total_lessons} />
              </>
            )}
          </div>
        </div>

        <div className="section-card">
          <div className="section-title">Edit Profile</div>
          <form onSubmit={handleProfileSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="profile-name">Full Name</label>
              <input
                id="profile-name"
                className="form-input"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="profile-email">Email</label>
              <input
                id="profile-email"
                className="form-input"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">Save Profile</button>
          </form>
        </div>

        <div className="section-card">
          <div className="section-title">Change Password</div>
          <form onSubmit={handlePasswordSubmit} className="auth-form">
            <input
              className="form-input"
              type="password"
              placeholder="Old password"
              value={passwordForm.old_password}
              onChange={(event) => setPasswordForm((current) => ({ ...current, old_password: event.target.value }))}
              required
            />
            <input
              className="form-input"
              type="password"
              placeholder="New password"
              value={passwordForm.new_password}
              onChange={(event) => setPasswordForm((current) => ({ ...current, new_password: event.target.value }))}
              required
            />
            <input
              className="form-input"
              type="password"
              placeholder="Confirm password"
              value={passwordForm.confirm_password}
              onChange={(event) => setPasswordForm((current) => ({ ...current, confirm_password: event.target.value }))}
              required
            />
            <button type="submit" className="btn btn-ghost">Change Password</button>
          </form>
        </div>
      </div>

      {profile.role === 'STUDENT' && (
        <div className="section-card">
          <div className="section-title">Recent Activity</div>
          {stats?.recent_activity?.length ? (
            <div className="lessons-list">
              {stats.recent_activity.map((activity) => (
                <Link key={activity.course_id} to={`/course/${activity.course_id}`} className="lesson-item">
                  <div className="lesson-number">{activity.progress}%</div>
                  <div className="lesson-content">
                    <div className="lesson-title">{activity.title}</div>
                    <div className="lesson-text">Last accessed {formatDate(activity.last_accessed_at)}</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="lesson-text">No recent activity yet.</p>
          )}
        </div>
      )}

      {profile.role === 'TEACHER' && (
        <div className="section-card">
          <div className="section-title">Your Courses</div>
          {stats?.courses?.length ? (
            <div className="lessons-list">
              {stats.courses.map((course) => (
                <Link key={course.id} to={`/course/${course.id}`} className="lesson-item">
                  <div className="lesson-number">{course.student_count || 0}</div>
                  <div className="lesson-content">
                    <div className="lesson-title">{course.title}</div>
                    <div className="lesson-text">
                      {(course.student_count || 0)} students enrolled - {(course.lesson_count || 0)} lessons
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="lesson-text">No courses created yet.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Profile;
