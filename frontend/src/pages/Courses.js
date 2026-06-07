import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { courseAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const COURSE_ICONS = ['📘', '🧠', '💻', '🎨', '🔬', '🌍', '📊', '🎵', '🏗️', '⚡'];

const Courses = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { user } = useAuth();

  useEffect(() => { loadCourses(); }, []);

  const loadCourses = async () => {
    try {
      const res = await courseAPI.getAll();
      setCourses(res.data);
    } catch (err) {
      console.error('Failed to load courses', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = courses.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span>Loading courses…</span>
      </div>
    );
  }

  return (
    <div className="page-wrapper animate-fadeUp">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Explore Courses</h1>
          <p className="page-subtitle">{courses.length} courses available — keep growing</p>
        </div>
        {user?.role === 'TEACHER' && (
          <Link to="/create-course" className="btn btn-primary" id="create-course-link">
            ✦ New Course
          </Link>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom: '2rem' }}>
        <input
          id="course-search"
          className="form-input"
          type="text"
          placeholder="🔍  Search courses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 420 }}
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔎</div>
          <h3>No courses found</h3>
          <p>Try a different search term or check back later.</p>
        </div>
      ) : (
        <div className="course-grid">
          {filtered.map((course, i) => (
            <Link
              key={course.id}
              to={`/course/${course.id}`}
              style={{ textDecoration: 'none' }}
              id={`course-card-${course.id}`}
            >
              <div
                className="course-card"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="course-card-header">
                  <div className="course-icon">
                    {COURSE_ICONS[course.id % COURSE_ICONS.length]}
                  </div>
                  <span className="badge badge-purple">
                    📚 {course.lesson_count || 0} lessons
                  </span>
                </div>
                {!course.approved && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <span className="badge badge-teal">Pending Approval</span>
                  </div>
                )}
                <div className="course-title">{course.title}</div>
                <div className="course-desc">
                  {course.description
                    ? course.description.substring(0, 110) + (course.description.length > 110 ? '…' : '')
                    : 'No description provided.'}
                </div>
                <div className="course-meta">
                  <span>🕐 Self-paced</span>
                  <span>🌐 Online</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Courses;
