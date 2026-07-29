'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck, User, X } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'forgot';
  onSuccess?: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_USER_EMAIL || 'demo@reachinbox.ai';
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_USER_PASSWORD || 'Demo@1234';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
const PASSWORD_MIN_LENGTH = 8;

const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-.9 2.4-2 3.1l3.2 2.5c1.9-1.7 3-4.3 3-7.3 0-.7-.1-1.4-.2-2H12z" />
    <path fill="#34A853" d="M6.4 14.3l-.7.5-2.6 2C4.8 20.1 8.2 22 12 22c2.7 0 5-0.9 6.7-2.4l-3.2-2.5c-.9.6-2 1-3.5 1-2.6 0-4.8-1.8-5.6-4.1z" />
    <path fill="#FBBC05" d="M3.1 7.2C2.4 8.6 2 10.2 2 12s.4 3.4 1.1 4.8l3.3-2.6c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2z" />
    <path fill="#4285F4" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9C17 2.9 14.7 2 12 2 8.2 2 4.8 3.9 3.1 7.2l3.3 2.6C7.2 7.5 9.4 5.9 12 5.9z" />
  </svg>
);

const isValidEmail = (value: string) => EMAIL_REGEX.test(value.trim().toLowerCase());

const getPasswordError = (value: string) => {
  if (value.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
  if (!/[A-Z]/.test(value)) return 'Password must include one uppercase letter.';
  if (!/[a-z]/.test(value)) return 'Password must include one lowercase letter.';
  if (!/\d/.test(value)) return 'Password must include one number.';
  return null;
};

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onSuccess,
}) => {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [resetTokenInput, setResetTokenInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetPreviewUrl, setResetPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      resetFormFields();
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const resetState = () => {
    setError(null);
    setSuccess(null);
    setResetPreviewUrl(null);
    setLoading(false);
  };

  const clearPasswordFields = () => {
    setPassword('');
    setConfirmPassword('');
    setNewPassword('');
    setResetTokenInput('');
    setShowPassword(false);
  };

  const resetFormFields = () => {
    resetState();
    setName('');
    setUsername('');
    setEmail('');
    setLoginInput('');
    clearPasswordFields();
    setForgotStep(1);
  };

  const switchMode = (newMode: 'login' | 'register' | 'forgot') => {
    resetState();
    clearPasswordFields();
    setMode(newMode);
    if (newMode === 'forgot' && isValidEmail(loginInput)) setEmail(loginInput.trim().toLowerCase());
    if (newMode === 'forgot') setForgotStep(1);
  };

  const continueWithGoogle = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  const useDemoAccount = () => {
    switchMode('login');
    setLoginInput(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setSuccess('Demo credentials filled. Click Login to continue.');
  };

  const completeAuth = () => {
    if (onSuccess) onSuccess();
    router.push('/dashboard');
    onClose();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();

    const trimmedLogin = loginInput.trim();

    if (!trimmedLogin || !password) {
      setError('Please enter your email or username and password.');
      return;
    }

    if (trimmedLogin.includes('@') && !isValidEmail(trimmedLogin)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      const res = await apiClient.post('/auth/login', { login: trimmedLogin, password });
      if (res.data.token) localStorage.setItem('auth_token', res.data.token);
      setSuccess('Login successful. Redirecting...');
      setTimeout(completeAuth, 700);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedUsername = username.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (trimmedName.length < 2) {
      setError('Full name must be at least 2 characters long.');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (trimmedUsername && !USERNAME_REGEX.test(trimmedUsername)) {
      setError('Username must be 3-30 characters and use only letters, numbers, or underscore.');
      return;
    }

    const passwordError = getPasswordError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      const res = await apiClient.post('/auth/register', {
        name: trimmedName,
        username: trimmedUsername || trimmedEmail.split('@')[0],
        email: trimmedEmail,
        password,
      });
      if (res.data.token) localStorage.setItem('auth_token', res.data.token);
      setSuccess('Account created. Redirecting...');
      setTimeout(completeAuth, 700);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      const res = await apiClient.post('/auth/forgot-password', { email: trimmedEmail });
      setEmail(trimmedEmail);
      setResetPreviewUrl(res.data.previewUrl || null);
      setSuccess('OTP sent. Enter the 6-digit code from your email to set a new password.');
      setForgotStep(2);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send reset OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();

    if (!resetTokenInput || !newPassword) {
      setError('Please enter the reset code and your new password.');
      return;
    }

    if (!/^\d{6}$/.test(resetTokenInput)) {
      setError('OTP must be exactly 6 digits.');
      return;
    }

    const passwordError = getPasswordError(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    try {
      setLoading(true);
      const res = await apiClient.post('/auth/reset-password', {
        token: resetTokenInput,
        newPassword,
      });
      setSuccess(res.data.message || 'Password updated successfully.');
      setTimeout(() => switchMode('login'), 1200);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-2xl md:grid-cols-[1fr_0.95fr]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <section className="px-8 py-8 md:px-10">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
              <Mail className="h-5 w-5" />
            </div>
            <span className="text-base font-bold text-slate-950">ReachInbox.ai</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-950">
            {mode === 'register' ? 'Create your account' : mode === 'forgot' ? 'Reset password' : 'Welcome Back'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'register'
              ? 'Start scheduling reliable email batches.'
              : mode === 'forgot'
                ? 'Generate a reset code for your account.'
                : 'Login to your account to continue'}
          </p>

          {mode !== 'forgot' && (
            <>
              <button
                type="button"
                onClick={continueWithGoogle}
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                <GoogleIcon />
                Continue with Google
              </button>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400">or</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            </>
          )}

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-[8px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 flex items-start gap-2 rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4" autoComplete="off" noValidate>
              <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Try demo account</p>
                    <p className="mt-1 font-mono text-[11px] text-slate-500">{DEMO_EMAIL} / {DEMO_PASSWORD}</p>
                  </div>
                  <button
                    type="button"
                    onClick={useDemoAccount}
                    className="shrink-0 rounded-[8px] bg-violet-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-violet-500"
                  >
                    Autofill
                  </button>
                </div>
              </div>

              <label className="block text-xs font-semibold text-slate-700">
                Email Address
                <input
                  type="text"
                  name="signin-login"
                  required
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="username"
                  className="mt-1.5 w-full rounded-[8px] border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                <span className="flex items-center justify-between">
                  Password
                  <button type="button" onClick={() => switchMode('forgot')} className="text-[11px] font-semibold text-violet-600">
                    Forgot password?
                  </button>
                </span>
                <div className="relative mt-1.5">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="signin-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full rounded-[8px] border border-slate-200 px-3 py-2.5 pr-10 text-sm font-normal text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60"
              >
                {loading ? 'Logging in...' : 'Login'}
                <ArrowRight className="h-4 w-4" />
              </button>

              <p className="pt-2 text-center text-xs text-slate-500">
                Do not have an account?{' '}
                <button type="button" onClick={() => switchMode('register')} className="font-semibold text-violet-600">
                  Create account
                </button>
              </p>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3" autoComplete="off" noValidate>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Full Name
                  <div className="relative mt-1.5">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input name="signup-name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" className="w-full rounded-[8px] border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" />
                  </div>
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Username
                  <input name="signup-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" className="mt-1.5 w-full rounded-[8px] border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" />
                </label>
              </div>
              <label className="block text-xs font-semibold text-slate-700">
                Email Address
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type="email" name="signup-email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="w-full rounded-[8px] border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" />
                </div>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                  <input type="password" name="signup-new-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" placeholder="8+ chars, Aa, 1" className="mt-1.5 w-full rounded-[8px] border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Confirm
                  <input type="password" name="signup-confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" className="mt-1.5 w-full rounded-[8px] border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" />
                </label>
              </div>
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 disabled:opacity-60">
                {loading ? 'Creating account...' : 'Create Account'}
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="text-center text-xs text-slate-500">
                Already have an account?{' '}
                <button type="button" onClick={() => switchMode('login')} className="font-semibold text-violet-600">
                  Login
                </button>
              </p>
            </form>
          )}

          {mode === 'forgot' && (
            <div>
              {forgotStep === 1 ? (
                <form onSubmit={handleForgotRequest} className="space-y-4" autoComplete="off" noValidate>
                  <div className="rounded-[8px] border border-violet-100 bg-violet-50 px-4 py-3">
                    <p className="text-xs font-bold text-violet-800">Forgot password?</p>
                    <p className="mt-1 text-xs leading-5 text-violet-700">
                      Enter any email address. The 6-digit OTP will be sent to that same email.
                    </p>
                  </div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Email Address
                    <input type="email" name="reset-email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="mt-1.5 w-full rounded-[8px] border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" />
                  </label>
                  <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
                    {loading ? 'Sending OTP...' : 'Send OTP'}
                    <KeyRound className="h-4 w-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetSubmit} className="space-y-4" autoComplete="off" noValidate>
                  <div className="rounded-[8px] border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-bold text-emerald-800">OTP sent to {email}</p>
                    <p className="mt-1 text-xs leading-5 text-emerald-700">
                      Check your email and enter the 6-digit OTP below. In Ethereal test mode, open the preview link.
                    </p>
                    {resetPreviewUrl && (
                      <a
                        href={resetPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex text-xs font-bold text-emerald-800 underline underline-offset-4"
                      >
                        Open OTP email preview
                      </a>
                    )}
                  </div>
                  <label className="block text-xs font-semibold text-slate-700">
                    6-digit OTP
                    <input
                      value={resetTokenInput}
                      onChange={(e) => setResetTokenInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      name="reset-otp"
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      className="mt-1.5 w-full rounded-[8px] border border-slate-200 px-3 py-2.5 text-center font-mono text-lg tracking-[0.5em] text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">
                    New Password
                    <div className="relative mt-1.5">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input type="password" name="reset-new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoComplete="new-password" placeholder="8+ chars, Aa, 1" className="w-full rounded-[8px] border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" />
                    </div>
                  </label>
                  <button type="submit" disabled={loading} className="w-full rounded-[8px] bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
                    {loading ? 'Updating password...' : 'Reset Password'}
                  </button>
                  <button type="button" onClick={() => setForgotStep(1)} className="w-full text-xs font-semibold text-slate-500 hover:text-violet-600">
                    Send OTP again
                  </button>
                </form>
              )}
              <button type="button" onClick={() => switchMode('login')} className="mt-5 text-xs font-semibold text-slate-500 hover:text-violet-600">
                Back to Login
              </button>
            </div>
          )}
        </section>

        <section className="hidden bg-slate-950 md:block">
          <div className="relative h-full min-h-[620px] w-full overflow-hidden">
            <img
              src="/auth-visual.svg"
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-white/10" />
            <div className="absolute bottom-8 left-8 right-8 rounded-[8px] border border-white/35 bg-white/78 p-4 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="grid flex-1 grid-cols-3 gap-2">
                  <div className="h-2 rounded-full bg-violet-500" />
                  <div className="h-2 rounded-full bg-sky-400" />
                  <div className="h-2 rounded-full bg-emerald-400" />
                  <div className="col-span-2 h-2 rounded-full bg-slate-200" />
                  <div className="h-2 rounded-full bg-slate-200" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
