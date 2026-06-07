import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { courseAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const AddLesson = () => {
  const { courseId } = useParams();
  const [courseTitle, setCourseTitle] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [teacherNotes, setTeacherNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect non-teachers
    if (user && user.role !== 'TEACHER') {
      navigate('/courses');
    }
    // Load course title for display
    const fetchCourse = async () => {
      try {
        const res = await courseAPI.getById(courseId);
        setCourseTitle(res.data.title);
      } catch {
        // ignore
      }
    };
    if (courseId) fetchCourse();
  }, [courseId, user, navigate]);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setVideoUrl('');
    setTeacherNotes('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      await courseAPI.addLesson({
        course_id: parseInt(courseId),
        title,
        content,
        video_url: videoUrl || null,
        teacher_notes: teacherNotes || null,
      });
      setSuccess(true);
      resetForm();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add lesson. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper animate-fadeUp">
      <div style={{ maxWidth: 660, margin: '0 auto' }}>
        {/* Breadcrumb */}
        <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'1.75rem', fontSize:'0.85rem', color:'var(--text-muted)' }}>
          <Link to="/courses" className="nav-link" style={{ padding:'0 4px' }}>Courses</Link>
          <span>›</span>
          <Link to={`/course/${courseId}`} className="nav-link" style={{ padding:'0 4px' }}>
            {courseTitle || `Course #${courseId}`}
          </Link>
          <span>›</span>
          <span style={{ color:'#a78bfa', fontWeight:600 }}>Add Lesson</span>
        </div>

        {/* Header */}
        <div style={{ marginBottom:'2rem' }}>
          <h1 className="page-title">Add a Lesson</h1>
          <p className="page-subtitle">
            {courseTitle ? `Adding to: ${courseTitle}` : 'Build your course content step by step'}
          </p>
        </div>

        {/* Success Banner */}
        {success && (
          <div className="alert alert-success" style={{ marginBottom:'1.5rem' }}>
            <span>🎉</span>
            <div>
              <strong>Lesson added successfully!</strong>
              <div style={{ fontSize:'0.85rem', marginTop:2 }}>
                Add another lesson below, or{' '}
                <Link to={`/course/${courseId}`} style={{ color:'#6ee7b7', fontWeight:600 }}>
                  view your course
                </Link>.
              </div>
            </div>
          </div>
        )}

        <div className="section-card">
          {error && (
            <div className="alert alert-error" style={{ marginBottom:'1.5rem' }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} id="add-lesson-form">
            <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="lesson-title">Lesson Title *</label>
                <input
                  id="lesson-title"
                  className="form-input"
                  type="text"
                  placeholder="e.g. Introduction to Async/Await"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="lesson-content">Lesson Content</label>
                <textarea
                  id="lesson-content"
                  className="form-input"
                  placeholder="Explain what students will learn in this lesson. You can include key concepts, code snippets, or an outline…"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={7}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="lesson-video-url">Video URL (optional)</label>
                <input
                  id="lesson-video-url"
                  className="form-input"
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
                <span style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:4 }}>
                  Paste a YouTube, Vimeo, or any public video link.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="lesson-teacher-notes">
                  Notes for Students (only visible to enrolled students)
                </label>
                <textarea
                  id="lesson-teacher-notes"
                  className="form-input"
                  placeholder="Add reminders, links, examples, or extra context students should read after the lesson..."
                  value={teacherNotes}
                  onChange={(e) => setTeacherNotes(e.target.value)}
                  rows={6}
                />
              </div>

              {/* Preview */}
              {title && (
                <div style={{
                  padding:'1.25rem 1.4rem',
                  background:'rgba(124,58,237,.08)',
                  border:'1px solid rgba(124,58,237,.2)',
                  borderRadius:'12px',
                }}>
                  <div style={{ fontSize:'0.75rem', fontWeight:700, color:'#a78bfa', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'.75rem' }}>
                    Preview
                  </div>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:'1rem' }}>
                    <div style={{ width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#7c3aed,#06b6d4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.8rem',fontWeight:700,color:'white',flexShrink:0 }}>
                      ?
                    </div>
                    <div>
                      <div style={{ fontWeight:700, color:'var(--text-primary)', marginBottom:'.35rem' }}>{title}</div>
                      {content && (
                        <div style={{ fontSize:'0.85rem', color:'var(--text-secondary)', lineHeight:1.55 }}>
                          {content.substring(0, 150)}{content.length > 150 ? '…' : ''}
                        </div>
                      )}
                      {videoUrl && (
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4, marginTop:'.5rem', fontSize:'0.78rem', fontWeight:600, color:'#a78bfa' }}>
                          ▶ Video attached
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display:'flex', gap:'1rem', justifyContent:'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => navigate(`/course/${courseId}`)}
                >
                  ← Back to Course
                </button>
                <button
                  id="add-lesson-submit-btn"
                  type="submit"
                  className="btn btn-success"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span style={{ width:16,height:16,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',display:'inline-block',animation:'spin .7s linear infinite' }} />
                      Adding…
                    </>
                  ) : '＋ Add Lesson'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Tip box */}
        <div style={{
          marginTop:'1.5rem',
          padding:'1.1rem 1.4rem',
          background:'rgba(6,182,212,.07)',
          border:'1px solid rgba(6,182,212,.2)',
          borderRadius:'12px',
          fontSize:'0.85rem',
          color:'#94a3b8',
          lineHeight:1.7,
        }}>
          <strong style={{ color:'#67e8f9', display:'block', marginBottom:'.35rem' }}>💡 Tips for great lessons</strong>
          Keep each lesson focused on one concept. Use the video URL to embed a tutorial, and
          write clear content notes so students can follow along even without the video.
        </div>
      </div>
    </div>
  );
};

export default AddLesson;
