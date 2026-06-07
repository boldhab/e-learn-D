import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { courseAPI, learningAPI } from '../services/api';
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
      const res = user.role === 'TEACHER'
        ? await courseAPI.getTeacherCourses(user.id)
        : await learningAPI.getMyCourses(user.id);
      setCourses(res.data);
    } catch (err) {
      console.error('Failed to load my courses', err);
    } finally {
      setLoading(false);
    }
  };

  const getProgressLabel = (pct) => {
    if (pct === 100) return { text: 'Completed', cls: 'badge-green' };
    if (pct > 0) return { text: `${pct}% done`, cls: 'badge-purple' };
    return { text: 'Not started', cls: 'badge-teal' };
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span>Loading your courses...</span>
      </div>
    );
  }

  const isTeacher = user?.role === 'TEACHER';
  const completed = courses.filter((course) => course.progress === 100).length;
  const inProgress = courses.filter((course) => course.progress > 0 && course.progress < 100).length;

  return (
    <div className="page-wrapper animate-fadeUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Courses</h1>
          <p className="page-subtitle">
            {isTeacher ? 'Manage the courses you teach' : 'Track your progress and keep growing'}
          </p>
        </div>
        <Link to={isTeacher ? '/create-course' : '/courses'} className="btn btn-ghost" id="browse-more-link">
          {isTeacher ? 'Create Course' : 'Browse More'}
        </Link>
      </div>

      {courses.length > 0 && !isTeacher && (
        <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap', marginBottom:'2rem' }}>
          {[
            { label:'Enrolled', value: courses.length, color:'rgba(124,58,237,.15)', border:'rgba(124,58,237,.3)', text:'#a78bfa' },
            { label:'In Progress', value: inProgress, color:'rgba(6,182,212,.10)', border:'rgba(6,182,212,.3)', text:'#67e8f9' },
            { label:'Completed', value: completed, color:'rgba(16,185,129,.10)', border:'rgba(16,185,129,.3)', text:'#6ee7b7' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                flex:'1 1 140px',
                padding:'1.1rem 1.4rem',
                background: stat.color,
                border: `1px solid ${stat.border}`,
                borderRadius:'14px',
              }}
            >
              <div style={{ fontSize:'1.5rem', fontWeight:800, color: stat.text }}>{stat.value}</div>
              <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)', fontWeight:600 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {courses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">-</div>
          <h3>{isTeacher ? 'No courses created yet' : 'No courses yet'}</h3>
          <p>{isTeacher ? 'Create your first course and start adding lessons.' : 'Browse our catalog and enroll in your first course.'}</p>
          <Link to={isTeacher ? '/create-course' : '/courses'} className="btn btn-primary" style={{ marginTop:'1.25rem' }} id="browse-courses-btn">
            {isTeacher ? 'Create Course' : 'Explore Courses'}
          </Link>
        </div>
      ) : (
        <div className="course-grid">
          {courses.map((course, index) => {
            const label = getProgressLabel(course.progress);
            return (
              <Link
                key={course.id}
                to={`/course/${course.id}`}
                className="my-course-card"
                id={`my-course-${course.id}`}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem', position:'relative' }}>
                  <div style={{
                    width:44,
                    height:44,
                    borderRadius:'10px',
                    background: isTeacher || course.progress !== 100
                      ? 'linear-gradient(135deg,#7c3aed,#06b6d4)'
                      : 'linear-gradient(135deg,#10b981,#06b6d4)',
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                    fontSize:'1rem',
                    color:'#fff',
                    fontWeight:800,
                  }}>
                    {isTeacher ? 'T' : course.progress === 100 ? '✓' : 'L'}
                  </div>
                  {isTeacher ? (
                    <span className="badge badge-purple">{course.approved ? 'Approved' : 'Pending'}</span>
                  ) : (
                    <span className={`badge ${label.cls}`}>{label.text}</span>
                  )}
                </div>

                <div className="my-course-card-title">{course.title}</div>

                {isTeacher ? (
                  <div className="lesson-text">{course.description || 'No description provided.'}</div>
                ) : (
                  <>
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
                  </>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyCourses;
