import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

import Auth from './pages/Auth'
import StudentDashboard from './pages/StudentDashboard'
import TutorDashboard from './pages/TutorDashboard'
import AdminDashboard from './pages/AdminDashboard'
import CourseViewer from './pages/CourseViewer'
import ResetPassword from './pages/ResetPassword'
import NotFound from './pages/NotFound'

import AuthWrapper from './AuthWrapper'
import ProtectedRoute from './ProtectedRoute'
import { useAuthStore } from './lib/store'

// A small component to automatically redirect logged-in users away from the Auth page
const AuthRoute = ({ children }) => {
  const { user, profile, isLoading } = useAuthStore();
  
  if (isLoading) return null;

  if (!user || !profile) return children;

  if (profile.role === 'admin') return <Navigate to="/admin" replace />;
  if (profile.role === 'instructor') return <Navigate to="/tutor" replace />;
  if (profile.role === 'student') return <Navigate to="/dashboard" replace />;
  
  return children;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthWrapper>
        <Routes>
          <Route path="/" element={<AuthRoute><Auth /></AuthRoute>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['student', 'instructor', 'admin']}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/course" element={<ProtectedRoute allowedRoles={['student', 'instructor', 'admin']}><CourseViewer /></ProtectedRoute>} />
          <Route path="/tutor" element={<ProtectedRoute allowedRoles={['instructor', 'admin']}><TutorDashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthWrapper>
    </BrowserRouter>
  </StrictMode>,
)
