import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { courseAPI, learningAPI, quizAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const CourseDetail = () => {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [enrolled, setEnrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { loadCourseData(); }, [id, user]);

  const loadCourseData = async () => {
    try {
      const courseRes = await courseAPI.getById(id);
      setCourse(courseRes.data);
      try {
        const quizRes = await quizAPI.getCourseQuizzes(id);
        setQuizzes(quizRes.data);
      } catch {
        setQuizzes([]);
      }
      if (user?.role === 'STUDENT') {
        try {
          const progressRes = await learningAPI.getProgress(user.id, id);
          setEnrolled(true);
          setProgress(progressRes.data.progress);
        } catch {
          setEnrolled(false);
        }
      }
    } catch (err) {
      console.error('Failed to load course', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      await learningAPI.enroll(id);
      setEnrolled(true);
      setProgress(0);
    } catch (err) {
      alert(err.response?.data?.error || 'Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  };

  const handleReportCourse = async () => {
    const reason = window.prompt('Why are you reporting this course?');
    if (!reason || !reason.trim()) {
      return;
    }

    try {
      await courseAPI.reportContent({
        content_type: 'COURSE',
        content_id: parseInt(id, 10),
        reason: reason.trim(),
      });
      alert('Report submitted. Thank you for helping keep the platform safe.');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit report');
    }
  };

  const openNotesEditor = (lesson) => {
    setEditingLesson(lesson);
    setNotesDraft(lesson.teacher_notes || '');
  };

  const handleSaveNotes = async () => {
    if (!editingLesson) return;

    setSavingNotes(true);
    try {
      const res = await courseAPI.updateLesson(editingLesson.id, {
        title: editingLesson.title,
        content: editingLesson.content,
        video_url: editingLesson.video_url,
        order: editingLesson.order,
        teacher_notes: notesDraft,
      });

      setCourse((current) => ({
        ...current,
        lessons: current.lessons.map((lesson) =>
          lesson.id === editingLesson.id ? { ...lesson, ...res.data } : lesson
        ),
      }));
      setEditingLesson(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save teacher notes');
    } finally {
      setSavingNotes(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span>Loading course…</span>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="page-wrapper">
        <div className="empty-state">
          <div className="empty-state-icon">❌</div>
          <h3>Course not found</h3>
          <p>This course may have been removed.</p>
          <Link to="/courses" className="btn btn-ghost" style={{ marginTop: '1rem' }}>← Back to courses</Link>
        </div>
      </div>
    );
  }

  const isTeacherOwner = user?.role === 'TEACHER' && user.id === course.teacher_id;

  return (
    <div className="page-wrapper animate-fadeUp">
      {/* Back link */}
      <Link to="/courses" className="nav-link" style={{ display:'inline-flex', alignItems:'center', gap:6, marginBottom:'1.5rem', fontSize:'0.85rem' }}>
        ← Back to Courses
      </Link>

      {/* Hero */}
      <div className="detail-hero">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'1rem', marginBottom:'1rem' }}>
          <div style={{ display:'flex', gap:'0.75rem', alignItems:'center' }}>
            <span className="badge badge-purple">📚 {course.lessons?.length || 0} Lessons</span>
            <span className="badge badge-teal">🕐 Self-paced</span>
            {!course.approved && (
              <span className="badge badge-teal">Pending Approval</span>
            )}
          </div>
          {isTeacherOwner && (
            <>
            <Link
              to={`/course/${id}/add-lesson`}
              className="btn btn-success btn-sm"
              id="add-lesson-link"
            >
              ＋ Add Lesson
            </Link>
            <Link
              to={`/course/${id}/create-quiz`}
              className="btn btn-primary btn-sm"
              style={{ marginLeft: '0.75rem' }}
            >
              Create Quiz
            </Link>
            <Link
              to={`/course/${id}/quizzes/manage`}
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: '0.75rem' }}
            >
              Manage Quizzes
            </Link>
            </>
          )}
        </div>

        <h1 className="detail-hero-title">{course.title}</h1>
        <p className="detail-hero-desc">{course.description || 'No description provided.'}</p>

        <div className="detail-hero-actions">
          {user?.role === 'STUDENT' && !enrolled && (
            <button
              id="enroll-btn"
              className="btn btn-primary btn-lg"
              onClick={handleEnroll}
              disabled={enrolling}
            >
              {enrolling ? (
                <>
                  <span style={{ width:18,height:18,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',display:'inline-block',animation:'spin .7s linear infinite' }} />
                  Enrolling…
                </>
              ) : '🚀 Enroll Now — Free'}
            </button>
          )}
          {user?.role === 'STUDENT' && enrolled && (
            <span className="badge badge-green" style={{ padding:'6px 14px', fontSize:'0.82rem' }}>
              ✅ Enrolled
            </span>
          )}
          {user?.role !== 'ADMIN' && user?.id !== course.teacher_id && (
            <button className="btn btn-ghost btn-lg" onClick={handleReportCourse}>
              Report Course
            </button>
          )}
        </div>
      </div>

      {/* Progress section (enrolled students) */}
      {user?.role === 'STUDENT' && enrolled && (
        <div className="progress-section" style={{ marginBottom: '2rem' }}>
          <h4>Your Progress</h4>
          <div className="progress-value">{progress}%</div>
          <div className="progress-track" style={{ marginBottom: '1rem' }}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          {progress === 100 ? (
            <Link to={`/certificate/${id}`} className="btn btn-success btn-sm">View Certificate</Link>
          ) : (
            <span style={{ fontSize:'0.85rem', color:'var(--text-secondary)' }}>
              Complete each lesson quiz with at least 50% to unlock full course completion.
            </span>
          )}
        </div>
      )}

      {/* Quizzes */}
      {quizzes.length > 0 && (
        <div className="section-card" style={{ marginBottom: '2rem' }}>
          <div className="section-title">
            Assessments
          </div>
          <div className="lessons-list">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="lesson-item">
                <div className="lesson-number">Q</div>
                <div className="lesson-content">
                  <div className="lesson-title">{quiz.title}</div>
                  {quiz.description && <div className="lesson-text">{quiz.description}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                    <span className="badge badge-purple">{quiz.total_questions} Questions</span>
                    <span className="badge badge-teal">Pass {quiz.passing_score}%</span>
                    {quiz.passed && <span className="badge badge-green">Passed</span>}
                    {user?.role === 'STUDENT' && enrolled && (
                      <Link to={`/quiz/${quiz.id}`} className="btn btn-primary btn-sm">
                        {quiz.attempts_count > 0 ? 'Continue Quiz' : 'Take Quiz'}
                      </Link>
                    )}
                    {user?.role === 'TEACHER' && (
                      <span className="badge badge-teal">{quiz.is_published ? 'Published' : 'Draft'}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lessons */}
      <div className="section-card">
        <div className="section-title">
          📖 Course Content
        </div>

        {!course.lessons || course.lessons.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem 1rem' }}>
            <div className="empty-state-icon">📭</div>
            <h3>No lessons yet</h3>
            <p>
              {isTeacherOwner
                ? 'Add your first lesson to get started.'
                : "The instructor hasn't added lessons yet. Check back soon!"}
            </p>
            {isTeacherOwner && (
              <Link to={`/course/${id}/add-lesson`} className="btn btn-primary" style={{ marginTop:'1rem' }}>
                ＋ Add First Lesson
              </Link>
            )}
          </div>
        ) : (
          <div className="lessons-list">
            {course.lessons.map((lesson, index) => (
              <Link key={lesson.id} to={`/course/${id}/lesson/${lesson.id}`} className="lesson-item" id={`lesson-${lesson.id}`}>
                <div className="lesson-number">{index + 1}</div>
                <div className="lesson-content">
                  <div className="lesson-title">{lesson.title}</div>
                  {lesson.content && (
                    <div className="lesson-text">{lesson.content}</div>
                  )}
                  {lesson.video_url && (
                    <a
                      href={lesson.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="lesson-video-link"
                    >
                      ▶ Watch Video
                    </a>
                  )}
                  {lesson.teacher_notes && (enrolled || isTeacherOwner) && (
                    <div className="teacher-notes-card">
                      <div className="teacher-notes-title">📝 Teacher's Notes</div>
                      <div className="teacher-notes-content">{lesson.teacher_notes}</div>
                    </div>
                  )}
                  {isTeacherOwner && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={(event) => {
                        event.preventDefault();
                        openNotesEditor(lesson);
                      }}
                      style={{ marginTop: '0.75rem' }}
                    >
                      Edit Notes
                    </button>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {editingLesson && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="edit-notes-title">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'1rem', marginBottom:'1rem' }}>
              <h3 id="edit-notes-title" style={{ color:'var(--text-primary)' }}>Edit Notes</h3>
              <button type="button" className="icon-button" onClick={() => setEditingLesson(null)} aria-label="Close notes editor">
                x
              </button>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="teacher-notes-editor">
                Notes for Students (only visible to enrolled students)
              </label>
              <textarea
                id="teacher-notes-editor"
                className="form-input"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={8}
              />
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'0.75rem', marginTop:'1.25rem' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditingLesson(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveNotes} disabled={savingNotes}>
                {savingNotes ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseDetail;
