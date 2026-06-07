import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { courseAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const CreateCourse = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  if (user?.role !== 'TEACHER') {
    navigate('/courses');
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await courseAPI.create({ title, description });
      navigate(`/course/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create course. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper animate-fadeUp">
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 className="page-title">Create New Course</h1>
          <p className="page-subtitle">Share your knowledge with the world</p>
        </div>

        <div className="section-card">
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} id="create-course-form">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="course-title">Course Title</label>
                <input
                  id="course-title"
                  className="form-input"
                  type="text"
                  placeholder="e.g. Advanced JavaScript Patterns"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
                <span style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:4 }}>
                  A clear, descriptive title helps students find your course.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="course-description">Description</label>
                <textarea
                  id="course-description"
                  className="form-input"
                  placeholder="Describe what students will learn, prerequisites, and course structure…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                />
                <span style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:4 }}>
                  A great description boosts enrollment. Aim for at least 2–3 sentences.
                </span>
              </div>

              {/* Preview card */}
              {title && (
                <div style={{
                  padding:'1.25rem',
                  background:'rgba(124,58,237,.08)',
                  border:'1px solid rgba(124,58,237,.2)',
                  borderRadius:'12px',
                }}>
                  <div style={{ fontSize:'0.75rem', fontWeight:700, color:'#a78bfa', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'.5rem' }}>
                    Preview
                  </div>
                  <div style={{ fontWeight:700, color:'var(--text-primary)', marginBottom:'.35rem' }}>{title}</div>
                  {description && (
                    <div style={{ fontSize:'0.85rem', color:'var(--text-secondary)', lineHeight:1.5 }}>
                      {description.substring(0, 120)}{description.length > 120 ? '…' : ''}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display:'flex', gap:'1rem', justifyContent:'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => navigate('/courses')}
                >
                  Cancel
                </button>
                <button
                  id="create-course-submit-btn"
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span style={{ width:16,height:16,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',display:'inline-block',animation:'spin .7s linear infinite' }} />
                      Creating…
                    </>
                  ) : '✦ Create Course'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateCourse;
