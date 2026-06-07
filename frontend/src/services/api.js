import axios from 'axios';

const AUTH_API = process.env.REACT_APP_AUTH_API_URL || 'http://localhost:5001/auth';
const AUTH_ADMIN_API = process.env.REACT_APP_AUTH_ADMIN_API_URL || 'http://localhost:5001/admin';
const COURSE_API = process.env.REACT_APP_COURSE_API_URL || 'http://localhost:5002/api';
const LEARNING_API = process.env.REACT_APP_LEARNING_API_URL || 'http://localhost:5003/api';

const api = axios.create();

// Request interceptor to add token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: (data) => axios.post(`${AUTH_API}/register`, data),
  login: (data) => axios.post(`${AUTH_API}/login`, data),
  getMe: () => api.get(`${AUTH_API}/me`),
  adminGetUsers: () => api.get(`${AUTH_ADMIN_API}/users`),
  adminUpdateUserStatus: (id, isActive) => api.patch(`${AUTH_ADMIN_API}/users/${id}/status`, { is_active: isActive }),
  adminAnalytics: () => api.get(`${AUTH_ADMIN_API}/analytics`),
  adminHealth: () => api.get(`${AUTH_ADMIN_API}/system-health`),
  adminExport: (dataset, format) => api.get(`${AUTH_ADMIN_API}/reports/export?dataset=${dataset}&format=${format}`, {
    responseType: 'blob',
  }),
};

export const courseAPI = {
  getAll: () => api.get(`${COURSE_API}/courses`),
  getById: (id) => api.get(`${COURSE_API}/courses/${id}`),
  create: (data) => api.post(`${COURSE_API}/courses`, data),
  addLesson: (data) => api.post(`${COURSE_API}/lessons`, data),
  getTeacherCourses: (teacherId) => api.get(`${COURSE_API}/teacher/${teacherId}/courses`),
  reportContent: (data) => api.post(`${COURSE_API}/report`, data),
  adminGetCourses: () => api.get(`${COURSE_API}/admin/courses`),
  adminApproveCourse: (id, approved = true) => api.patch(`${COURSE_API}/admin/courses/${id}/approve`, { approved }),
  adminGetReports: () => api.get(`${COURSE_API}/admin/reports`),
  adminUpdateReportStatus: (id, status) => api.patch(`${COURSE_API}/admin/reports/${id}`, { status }),
  adminSummary: () => api.get(`${COURSE_API}/admin/summary`),
};

export const quizAPI = {
  getCourseQuizzes: (courseId) => api.get(`${COURSE_API}/courses/${courseId}/quizzes`),
  getById: (id) => api.get(`${COURSE_API}/quizzes/${id}`),
  startAttempt: (id) => api.post(`${COURSE_API}/quizzes/${id}/attempt`, {}),
  submitAttempt: (attemptId, data) => api.post(`${COURSE_API}/attempts/${attemptId}/submit`, data),
  getAttemptResult: (attemptId) => api.get(`${COURSE_API}/attempts/${attemptId}/result`),
  getHistory: (studentId) => api.get(`${COURSE_API}/students/${studentId}/quiz-history`),
  create: (data) => api.post(`${COURSE_API}/quizzes`, data),
  update: (id, data) => api.put(`${COURSE_API}/quizzes/${id}`, data),
  delete: (id) => api.delete(`${COURSE_API}/quizzes/${id}`),
  publish: (id, isPublished = true) => api.post(`${COURSE_API}/quizzes/${id}/publish`, { is_published: isPublished }),
  getTeacherDetails: (id) => api.get(`${COURSE_API}/teacher/quizzes/${id}`),
  getAttempts: (id) => api.get(`${COURSE_API}/teacher/quizzes/${id}/attempts`),
  addQuestion: (quizId, data) => api.post(`${COURSE_API}/quizzes/${quizId}/questions`, data),
  updateQuestion: (questionId, data) => api.put(`${COURSE_API}/questions/${questionId}`, data),
  deleteQuestion: (questionId) => api.delete(`${COURSE_API}/questions/${questionId}`),
  addOption: (questionId, data) => api.post(`${COURSE_API}/questions/${questionId}/options`, data),
};

export const learningAPI = {
  enroll: (courseId) => api.post(`${LEARNING_API}/enroll`, { course_id: courseId }),
  getMyCourses: (studentId) => api.get(`${LEARNING_API}/my-courses/${studentId}`),
  updateProgress: (data) => api.put(`${LEARNING_API}/progress`, data),
  getProgress: (studentId, courseId) => api.get(`${LEARNING_API}/progress/${studentId}/${courseId}`),
  adminSummary: () => api.get(`${LEARNING_API}/admin/summary`),
};

export default api;
