import React, { useState, useEffect } from 'react';
import { BookOpen, Lock, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const navigate = useNavigate();

  // Supabase exchanges the URL hash tokens automatically.
  // Strategy: check for an existing session immediately (catches cases where
  // the PASSWORD_RECOVERY event fires before our listener is registered),
  // AND subscribe to the event as a fallback.
  useEffect(() => {
    // 1. Eagerly check if Supabase already has a valid session from the hash
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    // 2. Belt-and-suspenders: also listen for the event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setSessionReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setErrorMsg("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStatus('success');
      // Sign out so they log in fresh with the new password
      await supabase.auth.signOut();
      setTimeout(() => navigate('/'), 2500);
    } catch (err) {
      setErrorMsg(err.message || 'Could not update your password.');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-[32px] shadow-2xl p-10 font-sans">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-10">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
            <BookOpen size={24} />
          </div>
          <span className="font-bold text-2xl tracking-tight text-gray-900">omniLearn.</span>
        </div>

        {/* Success State */}
        {status === 'success' ? (
          <div className="text-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} className="text-emerald-500" />
            </div>
            <h1 className="font-black text-3xl text-gray-900 mb-3">Password updated!</h1>
            <p className="text-gray-500 text-sm mb-6">
              Your password has been changed. Redirecting you to sign in…
            </p>
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
            <h1 className="font-black text-3xl sm:text-4xl text-gray-900 mb-2">Set new password</h1>
            <p className="text-gray-500 font-medium mb-8 text-sm">
              Choose a strong password for your account.
            </p>

            {!sessionReady && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-sm font-semibold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                Verifying your reset link… please wait.
              </div>
            )}

            {errorMsg && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm font-semibold">
                {errorMsg}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleReset}>
              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-900">New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    disabled={!sessionReady}
                    className="w-full pl-4 pr-10 py-3 rounded-xl border border-gray-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 outline-none transition-all bg-white disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-900">Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    placeholder="Repeat your password"
                    disabled={!sessionReady}
                    className="w-full pl-4 pr-10 py-3 rounded-xl border border-gray-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 outline-none transition-all bg-white disabled:opacity-50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !sessionReady}
                className="w-full py-3.5 mt-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>Update Password <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
            </form>

            <p className="text-center mt-6 text-sm text-gray-400">
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
              >
                Sign in
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
