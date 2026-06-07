import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI, courseAPI } from '../services/api';

const AdminPanel = () => {
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [reports, setReports] = useState([]);
  const [health, setHealth] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [reportDataset, setReportDataset] = useState('summary');
  const [reportFormat, setReportFormat] = useState('csv');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');

    try {
      const [analyticsRes, usersRes, coursesRes, reportsRes, healthRes] = await Promise.all([
        authAPI.adminAnalytics(),
        authAPI.adminGetUsers(),
        courseAPI.adminGetCourses(),
        courseAPI.adminGetReports(),
        authAPI.adminHealth(),
      ]);

      setAnalytics(analyticsRes.data);
      setUsers(usersRes.data);
      setCourses(coursesRes.data.courses || []);
      setReports(reportsRes.data || []);
      setHealth(healthRes.data.services || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load admin dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const updateUserStatus = async (id, isActive) => {
    setBusyKey(`user-${id}`);
    try {
      const res = await authAPI.adminUpdateUserStatus(id, isActive);
      setUsers((current) => current.map((user) => (user.id === id ? res.data.user : user)));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update user status');
    } finally {
      setBusyKey('');
    }
  };

  const approveCourse = async (id, approved) => {
    setBusyKey(`course-${id}`);
    try {
      const res = await courseAPI.adminApproveCourse(id, approved);
      setCourses((current) => current.map((course) => (course.id === id ? res.data.course : course)));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update course approval');
    } finally {
      setBusyKey('');
    }
  };

  const updateReportStatus = async (id, status) => {
    setBusyKey(`report-${id}`);
    try {
      const res = await courseAPI.adminUpdateReportStatus(id, status);
      setReports((current) => current.map((report) => (report.id === id ? res.data.report : report)));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update report');
    } finally {
      setBusyKey('');
    }
  };

  const downloadReport = async () => {
    setBusyKey('export');
    try {
      const response = await authAPI.adminExport(reportDataset, reportFormat);
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${reportDataset}-report.${reportFormat === 'excel' ? 'xls' : 'csv'}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to download report');
    } finally {
      setBusyKey('');
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span>Loading admin panel...</span>
      </div>
    );
  }

  return (
    <div className="page-wrapper animate-fadeUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Panel</h1>
          <p className="page-subtitle">Manage users, courses, reports, health, and exports from one place.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={loadDashboard}>
            Refresh
          </button>
          <Link to="/courses" className="btn btn-primary">
            Open Courses
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      <div className="section-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div className="section-title" style={{ marginBottom: '.75rem' }}>Platform Snapshot</div>
            <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Quick view of users, courses, and learning activity.</div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className="glass" style={{ flex: '1 1 180px', padding: '1rem 1.2rem', borderRadius: '14px' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '.08em', color: '#94a3b8' }}>Users</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '.35rem' }}>{analytics?.users?.total_users ?? 0}</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '.25rem' }}>{analytics?.users?.active_users ?? 0} active</div>
            </div>
            <div className="glass" style={{ flex: '1 1 180px', padding: '1rem 1.2rem', borderRadius: '14px' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '.08em', color: '#94a3b8' }}>Courses</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '.35rem' }}>{analytics?.courses?.total_courses ?? 0}</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '.25rem' }}>{analytics?.courses?.pending_courses ?? 0} pending approval</div>
            </div>
            <div className="glass" style={{ flex: '1 1 180px', padding: '1rem 1.2rem', borderRadius: '14px' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '.08em', color: '#94a3b8' }}>Enrollments</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '.35rem' }}>{analytics?.learning?.total_enrollments ?? 0}</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '.25rem' }}>{analytics?.learning?.completed_enrollments ?? 0} completed</div>
            </div>
          </div>
        </div>
      </div>

      <div className="section-card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title">System Health</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          {health.map((service) => (
            <div key={service.service} className="glass" style={{ padding: '1rem', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
                <strong>{service.service}</strong>
                <span className={`badge ${service.healthy ? 'badge-green' : 'badge-red'}`}>
                  {service.healthy ? 'Healthy' : 'Down'}
                </span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{service.status}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section-card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title">Reports</div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <select className="form-input" value={reportDataset} onChange={(e) => setReportDataset(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="summary">Summary</option>
            <option value="users">Users</option>
            <option value="courses">Courses</option>
            <option value="reports">Reported Content</option>
          </select>
          <select className="form-input" value={reportFormat} onChange={(e) => setReportFormat(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="csv">CSV</option>
            <option value="excel">Excel</option>
          </select>
          <button className="btn btn-primary" onClick={downloadReport} disabled={busyKey === 'export'}>
            {busyKey === 'export' ? 'Preparing...' : 'Download'}
          </button>
        </div>
      </div>

      <div className="section-card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title">User Management</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: '0.8rem' }}>
                <th style={{ padding: '0.75rem 0' }}>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
                  <td style={{ padding: '0.85rem 0' }}>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>
                    <span className={`badge ${user.is_active ? 'badge-green' : 'badge-red'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {user.role === 'ADMIN' ? (
                      <span className="badge badge-purple">Protected</span>
                    ) : (
                      <button
                        className={`btn btn-sm ${user.is_active ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => updateUserStatus(user.id, !user.is_active)}
                        disabled={busyKey === `user-${user.id}`}
                      >
                        {busyKey === `user-${user.id}` ? 'Saving...' : user.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section-card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title">Course Approval</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: '0.8rem' }}>
                <th style={{ padding: '0.75rem 0' }}>Course</th>
                <th>Teacher</th>
                <th>Lessons</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id} style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
                  <td style={{ padding: '0.85rem 0' }}>{course.title}</td>
                  <td>{course.teacher_id}</td>
                  <td>{course.lesson_count || 0}</td>
                  <td>
                    <span className={`badge ${course.approved ? 'badge-green' : 'badge-teal'}`}>
                      {course.approved ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className={`btn btn-sm ${course.approved ? 'btn-ghost' : 'btn-primary'}`}
                      onClick={() => approveCourse(course.id, !course.approved)}
                      disabled={busyKey === `course-${course.id}`}
                    >
                      {busyKey === `course-${course.id}` ? 'Saving...' : course.approved ? 'Set Pending' : 'Approve'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section-card">
        <div className="section-title">Reported Content</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: '0.8rem' }}>
                <th style={{ padding: '0.75rem 0' }}>Content</th>
                <th>Reason</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
                  <td style={{ padding: '0.85rem 0' }}>
                    <div style={{ fontWeight: 600 }}>{report.content_title}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{report.content_type} #{report.content_id}</div>
                  </td>
                  <td style={{ maxWidth: 320 }}>{report.reason}</td>
                  <td>
                    <span className={`badge ${report.status === 'OPEN' ? 'badge-teal' : report.status === 'RESOLVED' ? 'badge-green' : 'badge-purple'}`}>
                      {report.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {report.status === 'OPEN' ? (
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => updateReportStatus(report.id, 'RESOLVED')}
                          disabled={busyKey === `report-${report.id}`}
                        >
                          Resolve
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => updateReportStatus(report.id, 'DISMISSED')}
                          disabled={busyKey === `report-${report.id}`}
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => updateReportStatus(report.id, 'OPEN')}
                        disabled={busyKey === `report-${report.id}`}
                      >
                        Reopen
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
