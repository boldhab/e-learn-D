import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { quizAPI } from '../services/api';

const ManageQuizzes = () => {
  const { courseId } = useParams();
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState(null);
  const [details, setDetails] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadQuizzes = async () => {
    setError('');
    try {
      const response = await quizAPI.getCourseQuizzes(courseId);
      setQuizzes(response.data);
      if (!selectedQuizId && response.data.length > 0) {
        setSelectedQuizId(response.data[0].id);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (quizId) => {
    if (!quizId) {
      setDetails(null);
      setAttempts([]);
      return;
    }

    try {
      const [detailsResponse, attemptsResponse] = await Promise.all([
        quizAPI.getTeacherDetails(quizId),
        quizAPI.getAttempts(quizId),
      ]);
      setDetails(detailsResponse.data);
      setAttempts(attemptsResponse.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load quiz details');
    }
  };

  useEffect(() => {
    loadQuizzes();
  }, [courseId]);

  useEffect(() => {
    loadDetails(selectedQuizId);
  }, [selectedQuizId]);

  const updateQuizField = (field, value) => {
    setDetails((current) => ({
      ...current,
      quiz: { ...current.quiz, [field]: value },
    }));
  };

  const updateQuestionField = (questionId, field, value) => {
    setDetails((current) => ({
      ...current,
      questions: current.questions.map((question) => (
        question.id === questionId ? { ...question, [field]: value } : question
      )),
    }));
  };

  const saveQuiz = async () => {
    if (!details) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      await quizAPI.update(details.quiz.id, {
        title: details.quiz.title,
        description: details.quiz.description,
        time_limit: details.quiz.time_limit,
        passing_score: details.quiz.passing_score,
        max_attempts: details.quiz.max_attempts,
      });

      for (const question of details.questions) {
        await quizAPI.updateQuestion(question.id, {
          question_text: question.question_text,
          question_type: question.question_type,
          points: question.points,
          explanation: question.explanation,
          expected_answer: question.expected_answer,
          order: question.order,
        });
      }

      await loadQuizzes();
      await loadDetails(details.quiz.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save quiz');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (quiz) => {
    setError('');
    try {
      await quizAPI.publish(quiz.id, !quiz.is_published);
      await loadQuizzes();
      await loadDetails(quiz.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update publish status');
    }
  };

  const deleteQuiz = async (quiz) => {
    if (!window.confirm(`Delete "${quiz.title}"?`)) {
      return;
    }

    try {
      await quizAPI.delete(quiz.id);
      setSelectedQuizId(null);
      setDetails(null);
      await loadQuizzes();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete quiz');
    }
  };

  const deleteQuestion = async (questionId) => {
    if (!window.confirm('Delete this question?')) {
      return;
    }

    try {
      await quizAPI.deleteQuestion(questionId);
      await loadDetails(selectedQuizId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete question');
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span>Loading quizzes...</span>
      </div>
    );
  }

  return (
    <div className="page-wrapper animate-fadeUp">
      <Link to={`/course/${courseId}`} className="nav-link" style={{ display: 'inline-flex', marginBottom: '1.5rem' }}>
        Back to course
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Manage Quizzes</h1>
          <p className="page-subtitle">Publish drafts, edit questions, and review student attempts.</p>
        </div>
        <Link to={`/course/${courseId}/create-quiz`} className="btn btn-primary">Create Quiz</Link>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {quizzes.length === 0 ? (
        <div className="empty-state">
          <h3>No quizzes yet</h3>
          <p>Create the first assessment for this course.</p>
          <Link to={`/course/${courseId}/create-quiz`} className="btn btn-primary" style={{ marginTop: '1rem' }}>Create Quiz</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
          <div className="section-card">
            <div className="section-title">Quizzes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {quizzes.map((quiz) => (
                <button
                  key={quiz.id}
                  type="button"
                  className="lesson-item"
                  onClick={() => setSelectedQuizId(quiz.id)}
                  style={{
                    textAlign: 'left',
                    borderColor: selectedQuizId === quiz.id ? '#7c3aed' : undefined,
                    cursor: 'pointer',
                  }}
                >
                  <div className="lesson-content">
                    <div className="lesson-title">{quiz.title}</div>
                    <div className="lesson-text">{quiz.total_questions} questions</div>
                    <span className={quiz.is_published ? 'badge badge-green' : 'badge badge-teal'}>
                      {quiz.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {details && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="section-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <div className="section-title">Quiz Settings</div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => togglePublish(details.quiz)}>
                      {details.quiz.is_published ? 'Unpublish' : 'Publish'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteQuiz(details.quiz)}>
                      Delete
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={saveQuiz} disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Title</label>
                    <input className="form-input" value={details.quiz.title} onChange={(event) => updateQuizField('title', event.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea className="form-input" rows={3} value={details.quiz.description || ''} onChange={(event) => updateQuizField('description', event.target.value)} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Passing Score</label>
                      <input className="form-input" type="number" min="1" max="100" value={details.quiz.passing_score} onChange={(event) => updateQuizField('passing_score', event.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Max Attempts</label>
                      <input className="form-input" type="number" min="1" value={details.quiz.max_attempts} onChange={(event) => updateQuizField('max_attempts', event.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Time Limit</label>
                      <input className="form-input" type="number" min="1" value={details.quiz.time_limit || ''} onChange={(event) => updateQuizField('time_limit', event.target.value || null)} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="section-card">
                <div className="section-title">Questions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {details.questions.map((question, index) => (
                    <div key={question.id} className="lesson-item" style={{ alignItems: 'stretch' }}>
                      <div className="lesson-number">{index + 1}</div>
                      <div className="lesson-content" style={{ display: 'grid', gap: '0.75rem' }}>
                        <textarea
                          className="form-input"
                          rows={2}
                          value={question.question_text}
                          onChange={(event) => updateQuestionField(question.id, 'question_text', event.target.value)}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                          <select className="form-input" value={question.question_type} onChange={(event) => updateQuestionField(question.id, 'question_type', event.target.value)}>
                            <option value="MCQ">Multiple Choice</option>
                            <option value="TRUE_FALSE">True / False</option>
                            <option value="TEXT">Text</option>
                          </select>
                          <input className="form-input" type="number" min="1" value={question.points} onChange={(event) => updateQuestionField(question.id, 'points', event.target.value)} />
                          <input className="form-input" type="number" value={question.order || 0} onChange={(event) => updateQuestionField(question.id, 'order', event.target.value)} />
                        </div>
                        {question.question_type === 'TEXT' && (
                          <input
                            className="form-input"
                            placeholder="Expected answer"
                            value={question.expected_answer || ''}
                            onChange={(event) => updateQuestionField(question.id, 'expected_answer', event.target.value)}
                          />
                        )}
                        <textarea
                          className="form-input"
                          rows={2}
                          placeholder="Explanation"
                          value={question.explanation || ''}
                          onChange={(event) => updateQuestionField(question.id, 'explanation', event.target.value)}
                        />
                        {question.options?.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {question.options.map((option) => (
                              <span key={option.id} className={option.is_correct ? 'badge badge-green' : 'badge badge-teal'} style={{ alignSelf: 'flex-start' }}>
                                {option.is_correct ? 'Correct: ' : ''}{option.text}
                              </span>
                            ))}
                          </div>
                        )}
                        <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => deleteQuestion(question.id)}>
                          Delete Question
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="section-card">
                <div className="section-title">Student Attempts</div>
                {attempts.length === 0 ? (
                  <p className="lesson-text">No attempts yet.</p>
                ) : (
                  <div className="lessons-list">
                    {attempts.map((attempt) => (
                      <div key={attempt.id} className="lesson-item">
                        <div className="lesson-number">#{attempt.attempt_number}</div>
                        <div className="lesson-content">
                          <div className="lesson-title">Student {attempt.student_id}</div>
                          <div className="lesson-text">
                            Score: {attempt.score ?? 0} | Percentage: {attempt.percentage ?? 0}% | {attempt.passed ? 'Passed' : 'Not passed'}
                          </div>
                          <div className="lesson-text">
                            {attempt.completed_at ? `Completed: ${new Date(attempt.completed_at).toLocaleString()}` : 'In progress'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ManageQuizzes;
