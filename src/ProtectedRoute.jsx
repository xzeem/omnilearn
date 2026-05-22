import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from './lib/store';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, profile } = useAuthStore();

  // 1. Not logged in? Send to Auth screen.
  if (!user) return <Navigate to="/" replace />;
  
  // 2. Logged in, but profile data hasn't loaded yet? Send to Auth page to re-sync.
  //    (Auth.jsx and AuthWrapper both set user+profile together, so this is a safety fallback.)
  if (!profile) return <Navigate to="/" replace />; 

  // 3. User is logged in and profile is loaded. Check their role.
  if (!allowedRoles.includes(profile.role)) {
    // They are trying to access a dashboard they don't own. Bounce them to their rightful place.
    if (profile.role === 'admin') return <Navigate to="/admin" replace />;
    if (profile.role === 'instructor') return <Navigate to="/tutor" replace />;
    if (profile.role === 'student') return <Navigate to="/dashboard" replace />;
    
    // 4. Absolute Failsafe: Their role is completely invalid/corrupted. 
    // We return a hard-coded error screen so it DOES NOT infinite redirect!
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50 font-sans p-4">
        <div className="max-w-md bg-white p-8 rounded-2xl shadow-xl border border-red-100 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold">!</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Account Error</h2>
          <p className="text-gray-500 mb-6">Your account role is corrupted. Please contact support.</p>
          <a href="/" onClick={() => window.location.reload()} className="text-indigo-600 font-bold hover:underline">Reload App</a>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
