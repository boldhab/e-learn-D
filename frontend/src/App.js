import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import MyCourses from './pages/MyCourses';
import CreateCourse from './pages/CreateCourse';
import CreateQuiz from './pages/CreateQuiz';
import ManageQuizzes from './pages/ManageQuizzes';
import AddLesson from './pages/AddLesson';
import AdminPanel from './pages/AdminPanel';
import Quiz from './pages/Quiz';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span>Loading…</span>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
};

const TeacherRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'TEACHER') return <Navigate to="/courses" />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'ADMIN') return <Navigate to="/courses" />;
  return children;
};

const HomeRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span>Loading…</span>
      </div>
    );
  }

  if (user?.role === 'ADMIN') {
    return <Navigate to="/admin" />;
  }

  return <Navigate to="/courses" />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/courses" element={
        <PrivateRoute><Courses /></PrivateRoute>
      } />

      <Route path="/course/:id" element={
        <PrivateRoute><CourseDetail /></PrivateRoute>
      } />

      <Route path="/course/:courseId/add-lesson" element={
        <TeacherRoute><AddLesson /></TeacherRoute>
      } />

      <Route path="/course/:courseId/create-quiz" element={
        <TeacherRoute><CreateQuiz /></TeacherRoute>
      } />

      <Route path="/course/:courseId/quizzes/manage" element={
        <TeacherRoute><ManageQuizzes /></TeacherRoute>
      } />

      <Route path="/quiz/:quizId" element={
        <PrivateRoute><Quiz /></PrivateRoute>
      } />

      <Route path="/my-courses" element={
        <PrivateRoute><MyCourses /></PrivateRoute>
      } />

      <Route path="/create-course" element={
        <TeacherRoute><CreateCourse /></TeacherRoute>
      } />

      <Route path="/admin" element={
        <AdminRoute><AdminPanel /></AdminRoute>
      } />

      <Route path="/" element={<HomeRedirect />} />
    </Routes>
  );
};

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Navbar />
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
