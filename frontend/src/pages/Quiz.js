import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { quizAPI } from '../services/api';

const Quiz = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [attemptId, setAttemptId] = useState(null);
  const [results, setResults] = useState(null);
  const [completionSummary, setCompletionSummary] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadQuiz = async () => {
      setLoading(true);
      setError('');

      try {
        const quizRes = await quizAPI.getById(quizId);
        const attemptRes = await quizAPI.startAttempt(quizId);

        setQuiz(quizRes.data.quiz);
        setQuestions(quizRes.data.questions);
        setAttemptId(attemptRes.data.attempt_id);

        if (quizRes.data.quiz.time_limit) {
          setTimeLeft(quizRes.data.quiz.time_limit * 60);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load quiz');
      } finally {
        setLoading(false);
      }
    };

    loadQuiz();
  }, [quizId]);

  useEffect(() => {
    if (!timeLeft || submitting || results) {
      return undefined;
    }

    if (timeLeft === 0) {
      submitQuiz();
      return undefined;
    }

    const timer = setInterval(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, submitting, results]);

  const totalAnswered = useMemo(() => {
    return questions.filter((question) => {
      const answer = answers[question.id];
      return answer?.selected_option_id || answer?.text_answer;
    }).length;
  }, [answers, questions]);

  const handleAnswer = (questionId, answer) => {
    setAnswers((current) => ({
      ...current,
      [questionId]: answer,
    }));
  };

  const submitQuiz = async () => {
    if (!attemptId || submitting) {
      return;
    }

    setSubmitting(true);
    setError('');

    const answersArray = questions.map((question) => ({
      question_id: question.id,
      selected_option_id: answers[question.id]?.selected_option_id || null,
      text_answer: answers[question.id]?.text_answer || null,
    }));

    try {
      const timeSpent = quiz.time_limit && timeLeft !== null ? quiz.time_limit * 60 - timeLeft : null;
      const submitRes = await quizAPI.submitAttempt(attemptId, {
        answers: answersArray,
        time_spent: timeSpent,
      });

      const resultRes = await quizAPI.getAttemptResult(attemptId);
      setResults(resultRes.data);
      setCompletionSummary(submitRes.data.lesson_completion || null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span>Loading quiz...</span>
      </div>
    );
  }

  if (error && !quiz) {
    return (
      <div className="page-wrapper">
        <div className="empty-state">
          <h3>Quiz unavailable</h3>
          <p>{error}</p>
          <button className="btn btn-ghost" onClick={() => navigate(-1)}>Back</button>
        </div>
      </div>
    );
  }

  if (results) {
    return (
      <div className="page-wrapper animate-fadeUp">
        <Link
          to={quiz.lesson_id ? `/course/${quiz.course_id}/lesson/${quiz.lesson_id}` : `/course/${quiz.course_id}`}
          className="nav-link"
          style={{ display: 'inline-flex', marginBottom: '1.5rem' }}
        >
          Back to content
        </Link>

        <div className="section-card" style={{ marginBottom: '1.5rem' }}>
          <div className="section-title">{results.attempt.quiz_title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '3rem', fontWeight: 800, color: results.attempt.passed ? '#22c55e' : '#ef4444' }}>
              {Math.round(results.attempt.percentage || 0)}%
            </div>
            <div>
              <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>
                {results.attempt.passed ? 'Passed' : 'Not passed'}
              </p>
              <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)' }}>
                Score: {results.attempt.score} points. Passing score: {results.attempt.passing_score}%.
              </p>
              {completionSummary && (
                <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)' }}>
                  Lesson complete. Course progress is now {completionSummary.progress}%.
                </p>
              )}
            </div>
          </div>
          {completionSummary?.course_completed && (
            <Link to={`/certificate/${quiz.course_id}`} className="btn btn-success" style={{ marginTop:'1.25rem' }}>
              Go to Certificate
            </Link>
          )}
        </div>

        <div className="section-card">
          <div className="section-title">Review answers</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {results.answers.map((answer, index) => (
              <div key={answer.id} className="lesson-item">
                <div className="lesson-number">{index + 1}</div>
                <div className="lesson-content">
                  <div className="lesson-title">{answer.question_text}</div>
                  <div className="lesson-text">
                    Your answer: {answer.selected_option || answer.text_answer || 'Not answered'}
                  </div>
                  {!answer.is_correct && answer.correct_answer && (
                    <div className="lesson-text">Correct answer: {answer.correct_answer}</div>
                  )}
                  {answer.explanation && (
                    <div className="lesson-text">Explanation: {answer.explanation}</div>
                  )}
                  <span className={answer.is_correct ? 'badge badge-green' : 'badge badge-purple'}>
                    {answer.points_earned} / {answer.max_points} points
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const current = questions[currentQuestion];

  return (
    <div className="page-wrapper animate-fadeUp">
      <Link
        to={quiz.lesson_id ? `/course/${quiz.course_id}/lesson/${quiz.lesson_id}` : `/course/${quiz.course_id}`}
        className="nav-link"
        style={{ display: 'inline-flex', marginBottom: '1.5rem' }}
      >
        Back to content
      </Link>

      <div className="detail-hero" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <span className="badge badge-purple">{totalAnswered} / {questions.length} answered</span>
          {timeLeft !== null && <span className="badge badge-teal">Time left: {formatTime(timeLeft)}</span>}
        </div>
        <h1 className="detail-hero-title">{quiz.title}</h1>
        <p className="detail-hero-desc">{quiz.description || `Passing score: ${quiz.passing_score}%`}</p>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {current ? (
        <div className="section-card">
          <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
            Question {currentQuestion + 1} of {questions.length}
          </div>
          <h2 style={{ marginTop: 0 }}>{current.question_text}</h2>

          {['MCQ', 'TRUE_FALSE'].includes(current.question_type) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
              {current.options.map((option) => (
                <label key={option.id} className="lesson-item" style={{ cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name={`question-${current.id}`}
                    checked={answers[current.id]?.selected_option_id === option.id}
                    onChange={() => handleAnswer(current.id, { selected_option_id: option.id })}
                  />
                  <span style={{ color: 'var(--text-primary)' }}>{option.text}</span>
                </label>
              ))}
            </div>
          )}

          {current.question_type === 'TEXT' && (
            <textarea
              className="form-input"
              rows={5}
              value={answers[current.id]?.text_answer || ''}
              onChange={(event) => handleAnswer(current.id, { text_answer: event.target.value })}
              placeholder="Type your answer..."
              style={{ marginTop: '1rem' }}
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '2rem' }}>
            <button
              className="btn btn-ghost"
              disabled={currentQuestion === 0}
              onClick={() => setCurrentQuestion((currentIndex) => currentIndex - 1)}
            >
              Previous
            </button>
            {currentQuestion === questions.length - 1 ? (
              <button className="btn btn-primary" onClick={submitQuiz} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Quiz'}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => setCurrentQuestion((currentIndex) => currentIndex + 1)}>
                Next
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <h3>No questions yet</h3>
          <p>This quiz cannot be taken until questions are added.</p>
        </div>
      )}
    </div>
  );
};

export default Quiz;
