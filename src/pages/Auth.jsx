import React, { useState } from 'react';
import { BookOpen, Mail, Lock, ArrowRight, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import heroImage from '../assets/hero.webp';

// ── Right Panel (shared) ──────────────────────────────────────────────────────
const RightPanel = () => (
  <div className="hidden lg:block lg:w-1/2 self-stretch p-4 pl-0">
    <div className="w-full h-full relative rounded-3xl overflow-hidden bg-indigo-50 shadow-inner">
      <div className="absolute inset-0 bg-indigo-600/5 mix-blend-overlay z-10" />
      <img
          src={heroImage}
          alt="Dashboard UI"
          className="w-full h-full object-cover object-center"
          fetchpriority="high"
          decoding="async"
          width={1024}
          height={1024}
        />
    </div>
  </div>
);

// ── Logo ──────────────────────────────────────────────────────────────────────
const Logo = () => (
  <div className="flex items-center gap-2 mb-10">
    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
      <BookOpen size={24} />
    </div>
    <span className="font-heading font-bold text-2xl tracking-tight text-gray-900">omniLearn.</span>
  </div>
);

// ── Error Banner ──────────────────────────────────────────────────────────────
const ErrorBanner = ({ errorMsg }) =>
  errorMsg ? (
    <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm font-semibold">
      {errorMsg}
    </div>
  ) : null;

// ── Input Field ───────────────────────────────────────────────────────────────
const Field = ({ label, type = 'text', value, onChange, placeholder, required = true, icon: Icon }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-semibold text-gray-900">{label}</label>
    <div className="relative">
      {Icon && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
          <Icon size={18} />
        </div>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full pl-4 pr-10 py-3 rounded-xl border border-gray-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 outline-none transition-all bg-white"
      />
    </div>
  </div>
);

// ── SubmitBtn ─────────────────────────────────────────────────────────────────
const SubmitBtn = ({ label, loading }) => (
  <button
    type="submit"
    disabled={loading}
    className="w-full py-3.5 mt-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 group"
  >
    {loading ? <Loader2 size={18} className="animate-spin" /> : (
      <>{label}<ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
    )}
  </button>
);

// View states: 'signin' | 'signup' | 'forgot' | 'forgot_sent' | 'email_confirm'
const Auth = () => {
  const [view, setView] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const navigate = useNavigate();
  const { setUser, setProfile } = useAuthStore();

  const reset = (nextView) => {
    setErrorMsg('');
    setPassword('');
    setView(nextView);
  };

  // ── Sign In ──────────────────────────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data?.user) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles').select('*').eq('id', data.user.id).single();

        if (profileError || !profileData) {
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert([{ id: data.user.id, role: 'student', full_name: 'Recovered User' }])
            .select().single();
          if (insertError) {
            await supabase.auth.signOut();
            throw new Error('Your account is corrupted and we could not repair it. Please create a new account.');
          }
          setUser(data.user);
          setProfile(newProfile);
        } else {
          setUser(data.user);
          setProfile(profileData);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred during sign in.');
    } finally {
      setLoading(false);
    }
  };

  // ── Sign Up ──────────────────────────────────────────────────────────────────
  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;
      // Show email confirmation screen — do NOT auto-login
      setView('email_confirm');
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred during sign up.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password ───────────────────────────────────────────────────────────
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setView('forgot_sent');
    } catch (err) {
      setErrorMsg(err.message || 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  VIEW: Email Confirmation Screen (after sign-up)
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'email_confirm') {
    return (
      <div className="w-full min-h-[100dvh] flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full lg:w-[80%] rounded-[40px] flex font-sans bg-white overflow-hidden shadow-2xl">
          <div className="w-full lg:w-1/2 flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-24 overflow-y-auto py-12">
            <div className="max-w-md w-full mx-auto my-auto text-center">
              <Logo />
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} className="text-emerald-500" />
              </div>
              <h1 className="font-heading font-black text-3xl text-gray-900 mb-3">Check your email</h1>
              <p className="text-gray-500 font-medium text-sm mb-2">
                We sent a confirmation link to
              </p>
              <p className="font-bold text-indigo-600 text-base mb-6">{email}</p>
              <p className="text-gray-400 text-sm mb-8">
                Click the link in the email to verify your account. Once confirmed, you can sign in.
              </p>
              <button
                onClick={() => { reset('signin'); setEmail(''); }}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
              >
                Back to Sign In
              </button>
              <p className="text-gray-400 text-xs mt-4">Didn't get an email? Check your spam folder.</p>
            </div>
          </div>
          <RightPanel />
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  VIEW: Forgot Password Sent Screen
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'forgot_sent') {
    return (
      <div className="w-full min-h-[100dvh] flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full lg:w-[80%] rounded-[40px] flex font-sans bg-white overflow-hidden shadow-2xl">
          <div className="w-full lg:w-1/2 flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-24 overflow-y-auto py-12">
            <div className="max-w-md w-full mx-auto my-auto text-center">
              <Logo />
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail size={36} className="text-indigo-500" />
              </div>
              <h1 className="font-heading font-black text-3xl text-gray-900 mb-3">Reset link sent!</h1>
              <p className="text-gray-500 font-medium text-sm mb-2">We sent a password reset link to</p>
              <p className="font-bold text-indigo-600 text-base mb-6">{email}</p>
              <p className="text-gray-400 text-sm mb-8">
                Click the link in your email to set a new password. It may take a minute to arrive.
              </p>
              <button
                onClick={() => reset('signin')}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
              >
                Back to Sign In
              </button>
              <p className="text-gray-400 text-xs mt-4">Didn't get an email? Check your spam folder.</p>
            </div>
          </div>
          <RightPanel />
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  VIEW: Forgot Password Form
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'forgot') {
    return (
      <div className="w-full min-h-[100dvh] flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full lg:w-[80%] rounded-[40px] flex font-sans bg-white overflow-hidden shadow-2xl">
          <div className="w-full lg:w-1/2 flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-24 overflow-y-auto py-12">
            <div className="max-w-md w-full mx-auto my-auto">
              <Logo />
              <button
                type="button"
                onClick={() => reset('signin')}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 font-semibold mb-6 transition-colors"
              >
                <ArrowLeft size={16} /> Back to Sign In
              </button>
              <h1 className="font-heading font-black text-3xl sm:text-4xl text-gray-900 mb-2">Forgot password?</h1>
              <p className="text-gray-500 font-medium mb-8 text-sm">
                Enter the email address linked to your account and we'll send you a reset link.
              </p>
              <ErrorBanner />
              <form className="space-y-4" onSubmit={handleForgotPassword}>
                <Field
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="Enter your email"
                  icon={Mail}
                />
                <SubmitBtn label="Send Reset Link" />
              </form>
            </div>
          </div>
          <RightPanel />
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  VIEW: Sign In / Sign Up
  // ════════════════════════════════════════════════════════════════════════════
  const isSignUp = view === 'signup';

  return (
    <div className='w-full min-h-[100dvh] flex items-center justify-center bg-gray-50 p-4'>
      <div className="w-full lg:w-[80%] rounded-[40px] flex font-sans bg-white overflow-hidden shadow-2xl">
        {/* Left Column - Form */}
        <div className="w-full lg:w-1/2 flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-24 overflow-y-auto py-12 relative">
          <div className="max-w-md w-full mx-auto my-auto">
            <Logo />
            <h1 className="font-heading font-black text-3xl sm:text-4xl text-gray-900 mb-2">
              {isSignUp ? 'Create an account' : 'Welcome back'}
            </h1>
            <p className="text-gray-500 font-medium mb-8 text-sm sm:text-base">
              {isSignUp ? 'Start your learning journey today.' : 'Please enter your details to sign in.'}
            </p>

            <ErrorBanner />

            <form className="space-y-4" onSubmit={isSignUp ? handleSignUp : handleSignIn}>
              {isSignUp && (
                <Field
                  label="Full Name"
                  value={fullName}
                  onChange={setFullName}
                  placeholder="John Doe"
                />
              )}

              <Field
                label="Email address"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="Enter Your Email"
                icon={Mail}
              />

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-gray-900">Password</label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => reset('forgot')}
                      className="text-sm text-indigo-600 font-semibold hover:text-indigo-700 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter Your Password"
                    className="w-full pl-4 pr-10 py-3 rounded-xl border border-gray-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 outline-none transition-all bg-white"
                  />
                </div>
              </div>

              {isSignUp && (
                <p className="text-xs text-gray-400 font-medium">
                  By creating an account you agree to confirm your email address before signing in.
                </p>
              )}

              <SubmitBtn label={isSignUp ? 'Create Account' : 'Sign In'} />
            </form>

            {/* Toggle */}
            <div className="mt-6 text-center">
              <p className="text-gray-500 font-medium text-sm">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                <button
                  type="button"
                  onClick={() => reset(isSignUp ? 'signin' : 'signup')}
                  className="ml-2 text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
                >
                  {isSignUp ? 'Sign in' : 'Sign up'}
                </button>
              </p>
            </div>
          </div>
        </div>

        <RightPanel />
      </div>
    </div>
  );
};

export default Auth;
