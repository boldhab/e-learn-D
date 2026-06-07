import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { courseAPI, learningAPI, quizAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const LessonDetail = () => {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [progress, setProgress] = useState(null);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadLesson = async () => {
      setLoading(true);
      setError('');

      try {
        const courseRes = await courseAPI.getById(courseId);
        const nextCourse = courseRes.data;
        const nextLesson = nextCourse.lessons?.find((item) => Number(item.id) === Number(lessonId));

        if (!nextLesson) {
          setError('Lesson not found');
          return;
        }

        setCourse(nextCourse);
        setLesson(nextLesson);

        if (user?.role === 'STUDENT') {
          try {
            const progressRes = await learningAPI.getProgress(user.id, courseId);
            setProgress(progressRes.data.progress);
            setEnrolled(true);
          } catch {
            setEnrolled(false);
          }
        }

        try {
          const quizRes = await quizAPI.getCourseQuizzes(courseId);
          setQuizzes(quizRes.data.filter((quiz) => Number(quiz.lesson_id) === Number(lessonId)));
        } catch {
          setQuizzes([]);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load lesson');
      } finally {
        setLoading(false);
      }
    };

    loadLesson();
  }, [courseId, lessonId, user]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span>Loading lesson...</span>
      </div>
    );
  }

  if (error || !course || !lesson) {
    return (
      <div className="page-wrapper">
        <div className="empty-state">
          <h3>Lesson unavailable</h3>
          <p>{error || 'This lesson could not be loaded.'}</p>
          <button className="btn btn-ghost" onClick={() => navigate(-1)}>Back</button>
        </div>
      </div>
    );
  }

  const isTeacherOwner = user?.role === 'TEACHER' && user.id === course.teacher_id;
  const visibleNotes = lesson.teacher_notes && (enrolled || isTeacherOwner);
  const passedLessonQuiz = quizzes.some((quiz) => quiz.passed);

  return (
    <div className="page-wrapper animate-fadeUp">
      <Link to={`/course/${courseId}`} className="nav-link" style={{ display:'inline-flex', marginBottom:'1.5rem' }}>
        Back to course
      </Link>

      <div className="detail-hero">
        <div style={{ display:'flex', gap:'.75rem', flexWrap:'wrap', marginBottom:'1rem' }}>
          <span className="badge badge-purple">{course.title}</span>
          {passedLessonQuiz && <span className="badge badge-green">Content complete</span>}
        </div>
        <h1 className="detail-hero-title">{lesson.title}</h1>
        <p className="detail-hero-desc">Study the content, then pass the lesson exam with at least 50% to count it toward course completion.</p>
      </div>

      <div className="section-card">
        <div className="section-title">Course Content Detail</div>
        {lesson.video_url && (
          <a href={lesson.video_url} target="_blank" rel="noopener noreferrer" className="lesson-video-link" style={{ marginBottom:'1rem' }}>
            Watch Video
          </a>
        )}
        <div className="lesson-detail-content">
          {lesson.content || 'No lesson content has been added yet.'}
        </div>

        {visibleNotes && (
          <div className="teacher-notes-card">
            <div className="teacher-notes-title">📝 Teacher's Notes</div>
            <div className="teacher-notes-content">{lesson.teacher_notes}</div>
          </div>
        )}
      </div>

      <div className="section-card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'1rem', flexWrap:'wrap', marginBottom:'1rem' }}>
          <div className="section-title" style={{ marginBottom:0 }}>Lesson Exam</div>
          {isTeacherOwner && (
            <Link to={`/course/${courseId}/create-quiz?lessonId=${lessonId}`} className="btn btn-primary btn-sm">
              Add Quiz Exam
            </Link>
          )}
        </div>

        {quizzes.length === 0 ? (
          <div className="empty-state" style={{ padding:'2rem 1rem' }}>
            <h3>No exam yet</h3>
            <p>{isTeacherOwner ? 'Add an exam for this content.' : 'The teacher has not added an exam for this content yet.'}</p>
          </div>
        ) : (
          <div className="lessons-list">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="lesson-item">
                <div className="lesson-number">Q</div>
                <div className="lesson-content">
                  <div className="lesson-title">{quiz.title}</div>
                  {quiz.description && <div className="lesson-text">{quiz.description}</div>}
                  <div style={{ display:'flex', alignItems:'center', gap:'.75rem', flexWrap:'wrap', marginTop:'.75rem' }}>
                    <span className="badge badge-teal">Pass {quiz.passing_score}%</span>
                    <span className="badge badge-purple">{quiz.total_questions} Questions</span>
                    {quiz.passed && <span className="badge badge-green">Passed</span>}
                    {user?.role === 'STUDENT' && enrolled && (
                      <Link to={`/quiz/${quiz.id}`} className="btn btn-primary btn-sm">
                        {quiz.passed ? 'Review / Retake' : 'Take Exam'}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {user?.role === 'STUDENT' && enrolled && (
        <div className="progress-section">
          <h4>Course Progress</h4>
          <div className="progress-value">{progress ?? 0}%</div>
          <div className="progress-track" style={{ marginBottom:'1rem' }}>
            <div className="progress-fill" style={{ width: `${progress ?? 0}%` }} />
          </div>
          {(progress ?? 0) >= 100 && (
            <Link to={`/certificate/${courseId}`} className="btn btn-success btn-sm">Go to Certificate</Link>
          )}
        </div>
      )}
    </div>
  );
};

export default LessonDetail;
