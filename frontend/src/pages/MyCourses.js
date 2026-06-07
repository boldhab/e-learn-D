import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { learningAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const MyCourses = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) loadMyCourses();
  }, [user]);

  const loadMyCourses = async () => {
    try {
      const res = await learningAPI.getMyCourses(user.id);
      setCourses(res.data);
    } catch (err) {
      console.error('Failed to load my courses', err);
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = (pct) => {
    if (pct === 100) return '#10b981';
    if (pct >= 50)   return '#06b6d4';
    if (pct > 0)     return '#7c3aed';
    return '#475569';
  };

  const getProgressLabel = (pct) => {
    if (pct === 100) return { text: '🎉 Completed', cls: 'badge-green' };
    if (pct > 0)     return { text: `${pct}% done`, cls: 'badge-purple' };
    return { text: 'Not started', cls: 'badge-teal' };
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span>Loading your courses…</span>
      </div>
    );
  }

  const completed   = courses.filter(c => c.progress === 100).length;
  const inProgress  = courses.filter(c => c.progress > 0 && c.progress < 100).length;

  return (
    <div className="page-wrapper animate-fadeUp">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Learning</h1>
          <p className="page-subtitle">Track your progress and keep growing</p>
        </div>
        <Link to="/courses" className="btn btn-ghost" id="browse-more-link">
          Browse More →
        </Link>
      </div>

      {/* Stats bar */}
      {courses.length > 0 && (
        <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap', marginBottom:'2rem' }}>
          {[
            { label:'Enrolled', value: courses.length, icon:'📚', color:'rgba(124,58,237,.15)', border:'rgba(124,58,237,.3)', text:'#a78bfa' },
            { label:'In Progress', value: inProgress,  icon:'⚡', color:'rgba(6,182,212,.10)',  border:'rgba(6,182,212,.3)',  text:'#67e8f9' },
            { label:'Completed',  value: completed,    icon:'🏆', color:'rgba(16,185,129,.10)', border:'rgba(16,185,129,.3)', text:'#6ee7b7' },
          ].map(stat => (
            <div
              key={stat.label}
              style={{
                flex:'1 1 140px',
                padding:'1.1rem 1.4rem',
                background: stat.color,
                border: `1px solid ${stat.border}`,
                borderRadius:'14px',
                display:'flex',
                alignItems:'center',
                gap:'0.75rem',
              }}
            >
              <span style={{ fontSize:'1.6rem' }}>{stat.icon}</span>
              <div>
                <div style={{ fontSize:'1.5rem', fontWeight:800, color: stat.text }}>{stat.value}</div>
                <div style={{ fontSize:'0.75rem', color:'#94a3b8', fontWeight:600 }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {courses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <h3>No courses yet</h3>
          <p>Browse our catalog and enroll in your first course!</p>
          <Link to="/courses" className="btn btn-primary" style={{ marginTop:'1.25rem' }} id="browse-courses-btn">
            Explore Courses →
          </Link>
        </div>
      ) : (
        <div className="course-grid">
          {courses.map((course, i) => {
            const label = getProgressLabel(course.progress);
            return (
              <Link
                key={course.id}
                to={`/course/${course.id}`}
                className="my-course-card"
                id={`my-course-${course.id}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* Completion glow */}
                {course.progress === 100 && (
                  <div style={{
                    position:'absolute', inset:0, borderRadius:'inherit',
                    background:'radial-gradient(ellipse at top right, rgba(16,185,129,.12) 0%, transparent 70%)',
                    pointerEvents:'none',
                  }} />
                )}

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem', position:'relative' }}>
                  <div style={{
                    width:44, height:44, borderRadius:'10px',
                    background: course.progress === 100
                      ? 'linear-gradient(135deg,#10b981,#06b6d4)'
                      : 'linear-gradient(135deg,#7c3aed,#06b6d4)',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem',
                  }}>
                    {course.progress === 100 ? '🏆' : '📘'}
                  </div>
                  <span className={`badge ${label.cls}`}>{label.text}</span>
                </div>

                <div className="my-course-card-title">{course.title}</div>

                <div className="my-course-progress-label">
                  <span>Progress</span>
                  <span className="my-course-progress-pct">{course.progress}%</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${course.progress}%`,
                      background: course.progress === 100
                        ? 'linear-gradient(135deg,#10b981,#06b6d4)'
                        : undefined,
                    }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyCourses;
