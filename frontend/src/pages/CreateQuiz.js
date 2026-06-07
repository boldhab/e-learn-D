import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { quizAPI } from '../services/api';

const blankQuestion = () => ({
  question_text: '',
  question_type: 'MCQ',
  points: 1,
  explanation: '',
  expected_answer: '',
  options: [
    { option_text: '', is_correct: true },
    { option_text: '', is_correct: false },
  ],
});

const CreateQuiz = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState('');
  const [passingScore, setPassingScore] = useState(70);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [publishNow, setPublishNow] = useState(true);
  const [questions, setQuestions] = useState([blankQuestion()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateQuestion = (index, updates) => {
    setQuestions((current) => current.map((question, questionIndex) => (
      questionIndex === index ? { ...question, ...updates } : question
    )));
  };

  const updateOption = (questionIndex, optionIndex, updates) => {
    setQuestions((current) => current.map((question, currentQuestionIndex) => {
      if (currentQuestionIndex !== questionIndex) {
        return question;
      }

      return {
        ...question,
        options: question.options.map((option, currentOptionIndex) => (
          currentOptionIndex === optionIndex ? { ...option, ...updates } : option
        )),
      };
    }));
  };

  const addOption = (questionIndex) => {
    setQuestions((current) => current.map((question, currentQuestionIndex) => (
      currentQuestionIndex === questionIndex
        ? { ...question, options: [...question.options, { option_text: '', is_correct: false }] }
        : question
    )));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const quizRes = await quizAPI.create({
        course_id: parseInt(courseId, 10),
        title,
        description,
        time_limit: timeLimit ? parseInt(timeLimit, 10) : null,
        passing_score: parseInt(passingScore, 10),
        max_attempts: parseInt(maxAttempts, 10),
      });

      for (const [index, question] of questions.entries()) {
        await quizAPI.addQuestion(quizRes.data.id, {
          ...question,
          order: index,
          points: parseInt(question.points, 10),
          options: question.question_type === 'TEXT'
            ? []
            : question.options.filter((option) => option.option_text.trim()),
        });
      }

      if (publishNow) {
        await quizAPI.publish(quizRes.data.id, true);
      }

      navigate(`/course/${courseId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create quiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper animate-fadeUp">
      <Link to={`/course/${courseId}`} className="nav-link" style={{ display: 'inline-flex', marginBottom: '1.5rem' }}>
        Back to course
      </Link>

      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <h1 className="page-title">Create Quiz</h1>
        <p className="page-subtitle">Build an assessment students can take after the course material.</p>

        <div className="section-card">
          {error && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="quiz-title">Quiz Title</label>
              <input
                id="quiz-title"
                className="form-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="quiz-description">Description</label>
              <textarea
                id="quiz-description"
                className="form-input"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="passing-score">Passing Score</label>
                <input
                  id="passing-score"
                  className="form-input"
                  type="number"
                  min="1"
                  max="100"
                  value={passingScore}
                  onChange={(event) => setPassingScore(event.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="max-attempts">Max Attempts</label>
                <input
                  id="max-attempts"
                  className="form-input"
                  type="number"
                  min="1"
                  value={maxAttempts}
                  onChange={(event) => setMaxAttempts(event.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="time-limit">Time Limit</label>
                <input
                  id="time-limit"
                  className="form-input"
                  type="number"
                  min="1"
                  placeholder="Minutes"
                  value={timeLimit}
                  onChange={(event) => setTimeLimit(event.target.value)}
                />
              </div>
            </div>

            {questions.map((question, questionIndex) => (
              <div key={questionIndex} className="section-card" style={{ background: 'rgba(15, 23, 42, 0.35)' }}>
                <div className="section-title">Question {questionIndex + 1}</div>
                <div className="form-group">
                  <label className="form-label">Question Text</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={question.question_text}
                    onChange={(event) => updateQuestion(questionIndex, { question_text: event.target.value })}
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select
                      className="form-input"
                      value={question.question_type}
                      onChange={(event) => updateQuestion(questionIndex, { question_type: event.target.value })}
                    >
                      <option value="MCQ">Multiple Choice</option>
                      <option value="TRUE_FALSE">True / False</option>
                      <option value="TEXT">Text</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Points</label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      value={question.points}
                      onChange={(event) => updateQuestion(questionIndex, { points: event.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label className="form-label">Explanation</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={question.explanation}
                    onChange={(event) => updateQuestion(questionIndex, { explanation: event.target.value })}
                  />
                </div>

                {question.question_type !== 'TEXT' && (
                  <div style={{ marginTop: '1rem' }}>
                    <div className="form-label">Options</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {question.options.map((option, optionIndex) => (
                        <label key={optionIndex} className="lesson-item" style={{ alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={option.is_correct}
                            onChange={(event) => updateOption(questionIndex, optionIndex, { is_correct: event.target.checked })}
                          />
                          <input
                            className="form-input"
                            value={option.option_text}
                            placeholder={`Option ${optionIndex + 1}`}
                            onChange={(event) => updateOption(questionIndex, optionIndex, { option_text: event.target.value })}
                          />
                        </label>
                      ))}
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: '0.75rem' }} onClick={() => addOption(questionIndex)}>
                      Add Option
                    </button>
                  </div>
                )}
                {question.question_type === 'TEXT' && (
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label className="form-label">Expected Answer</label>
                    <input
                      className="form-input"
                      value={question.expected_answer}
                      onChange={(event) => updateQuestion(questionIndex, { expected_answer: event.target.value })}
                      placeholder="Exact answer used for auto-grading"
                    />
                  </div>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setQuestions((current) => [...current, blankQuestion()])}>
                Add Question
              </button>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={publishNow}
                  onChange={(event) => setPublishNow(event.target.checked)}
                />
                Publish immediately
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <Link to={`/course/${courseId}`} className="btn btn-ghost">Cancel</Link>
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Quiz'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateQuiz;
