'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  User,
  AtSign,
  Mail,
  Lock,
  CheckCircle2,
  AlertCircle,
  Save,
  ShieldCheck,
  Camera,
  Upload,
  Trash2,
  Wand2,
  Crown,
  BadgeCheck,
  KeyRound,
  Gauge,
  Copy,
} from 'lucide-react';
import { User as UserType } from '@/types';
import { apiClient } from '@/lib/apiClient';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType | null;
  onProfileUpdated: (updatedUser: UserType) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onProfileUpdated,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'security'>('details');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUsername(user.username || '');
      setEmail(user.email || '');
      setAvatarUrl(user.avatarUrl || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError(null);
      setSuccess(null);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const initials = (name || email || 'U').charAt(0).toUpperCase();
  const profileScore = [name, username, email, avatarUrl].filter(Boolean).length * 25;
  const passwordScore = Math.min(
    100,
    (newPassword.length >= 6 ? 35 : 0) +
      (/[A-Z]/.test(newPassword) ? 20 : 0) +
      (/\d/.test(newPassword) ? 20 : 0) +
      (/[^A-Za-z0-9]/.test(newPassword) ? 25 : 0)
  );

  const resetState = () => {
    setError(null);
    setSuccess(null);
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose a valid image file.');
      return;
    }

    if (file.size > 1.5 * 1024 * 1024) {
      setError('Profile photo must be smaller than 1.5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(String(reader.result));
      setError(null);
      setSuccess('Photo added. Save profile to apply it.');
    };
    reader.onerror = () => setError('Could not read this image. Try another photo.');
    reader.readAsDataURL(file);
  };

  const generateInitialAvatar = () => {
    const generated = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || email || 'User')}&background=6366f1&color=fff&bold=true&size=256`;
    setAvatarUrl(generated);
    setSuccess('Premium initials avatar generated. Save profile to apply it.');
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setSuccess('Email copied to clipboard.');
    } catch {
      setError('Clipboard is not available in this browser.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();

    if (activeTab === 'security' && newPassword) {
      if (newPassword !== confirmPassword) {
        setError('New passwords do not match.');
        return;
      }
      if (newPassword.length < 6) {
        setError('New password must be at least 6 characters long.');
        return;
      }
    }

    try {
      setLoading(true);
      const payload: any = {
        name,
        username,
        email,
        avatarUrl,
      };

      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await apiClient.put('/auth/profile', payload);

      setSuccess('Profile updated successfully!');
      onProfileUpdated(res.data.user);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/70 to-transparent" />

        <div className="flex flex-col md:flex-row gap-6">
          <aside className="md:w-64 shrink-0 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-center">
              <div className="relative mx-auto w-28 h-28">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={name || 'Profile photo'}
                    className="w-28 h-28 rounded-3xl object-cover ring-2 ring-indigo-500/50 shadow-lg"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-3xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-sky-500 text-white font-bold text-4xl flex items-center justify-center shadow-lg">
                    {initials}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-2 -right-2 p-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg border border-indigo-400/50 transition-colors"
                  title="Upload photo"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />

              <h2 className="mt-4 text-lg font-bold text-white tracking-tight">{name || 'Your Profile'}</h2>
              <p className="text-xs text-slate-400 truncate">{username ? `@${username}` : email}</p>

              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                  <Crown className="w-3.5 h-3.5" /> Pro Workspace
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                  <BadgeCheck className="w-3.5 h-3.5" /> Active
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Profile Strength</span>
                <span className="font-bold text-white">{profileScore}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400" style={{ width: `${profileScore}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                <span className="rounded-xl bg-slate-900 px-2.5 py-2">Verified email</span>
                <span className="rounded-xl bg-slate-900 px-2.5 py-2">Photo ready</span>
              </div>
            </div>
          </aside>

          <section className="flex-1 min-w-0">
            <div className="mb-5 pr-10">
              <h2 className="text-xl font-bold text-white tracking-tight">Account Settings</h2>
              <p className="text-xs text-slate-400">Manage profile, photo, identity and password security.</p>
            </div>

            <div className="flex p-1 bg-slate-950/60 rounded-2xl border border-slate-800 mb-5">
              <button
                onClick={() => {
                  resetState();
                  setActiveTab('details');
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-xl transition-all ${
                  activeTab === 'details'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-4 h-4" />
                Profile Details
              </button>
              <button
                onClick={() => {
                  resetState();
                  setActiveTab('security');
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-xl transition-all ${
                  activeTab === 'security'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Security
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-3.5 mb-4 rounded-2xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-start gap-2.5 p-3.5 mb-4 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {activeTab === 'details' ? (
                <>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Username</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                          <AtSign className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="username"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-12 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                      <button type="button" onClick={copyEmail} className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-indigo-300" title="Copy email">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-200">Profile Photo</label>
                        <p className="text-[11px] text-slate-500">Upload a photo, paste an image URL, or generate a polished initials avatar.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800" title="Upload image">
                          <Upload className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={generateInitialAvatar} className="p-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800" title="Generate avatar">
                          <Wand2 className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => setAvatarUrl('')} className="p-2 rounded-xl border border-slate-700 text-rose-300 hover:bg-rose-950/40" title="Remove photo">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://... or uploaded photo data"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                      <KeyRound className="w-4 h-4 text-indigo-300 mb-2" />
                      <p className="text-xs font-semibold text-white">Password Login</p>
                      <p className="text-[11px] text-slate-500">Bcrypt protected</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                      <ShieldCheck className="w-4 h-4 text-emerald-300 mb-2" />
                      <p className="text-xs font-semibold text-white">JWT Session</p>
                      <p className="text-[11px] text-slate-500">7 day secure token</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                      <Gauge className="w-4 h-4 text-sky-300 mb-2" />
                      <p className="text-xs font-semibold text-white">Strength Meter</p>
                      <p className="text-[11px] text-slate-500">Live password score</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Current Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">New Password</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                          <Lock className="w-4 h-4 text-indigo-400" />
                        </div>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Confirm New Password</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                          <Lock className="w-4 h-4 text-indigo-400" />
                        </div>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-slate-400">New password strength</span>
                      <span className="font-bold text-white">{newPassword ? `${passwordScore}%` : 'Not set'}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 transition-all" style={{ width: `${newPassword ? passwordScore : 0}%` }} />
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-md active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};
