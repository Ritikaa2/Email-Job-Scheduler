import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { User } from '@/types';
import { Mail, LogOut, ChevronDown, Sparkles, Home, UserCheck, Settings } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onComposeClick: () => void;
  onOpenProfile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout, onComposeClick, onOpenProfile }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-indigo-400 flex items-center justify-center text-white shadow-glow group-hover:scale-105 transition-transform">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
              FlowSend <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 font-semibold border border-indigo-800">Pro</span>
            </h1>
            <p className="text-xs text-slate-400 -mt-0.5">Automated Email Dispatcher</p>
          </div>
        </Link>

        {/* Right Action Bar */}
        <div className="flex items-center gap-4">
          <button
            onClick={onComposeClick}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-sm transition-all shadow-md shadow-indigo-500/20 active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            Compose New Email
          </button>

          {/* User Profile Dropdown */}
          {user && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-900 transition-colors border border-transparent hover:border-slate-800"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-indigo-500/30"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-semibold flex items-center justify-center text-sm shadow-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-semibold text-slate-200 leading-tight">
                    {user.name}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {user.username ? `@${user.username}` : user.email}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2.5 border-b border-slate-800">
                    <p className="text-xs font-semibold text-white">{user.name}</p>
                    {user.username && (
                      <p className="text-[11px] text-indigo-400 font-medium">@{user.username}</p>
                    )}
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                  </div>

                  {onOpenProfile && (
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenProfile();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-indigo-400" />
                      Edit Profile & Security
                    </button>
                  )}

                  <Link
                    href="/"
                    onClick={() => setDropdownOpen(false)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    <Home className="w-4 h-4 text-indigo-400" />
                    Opening Dashboard
                  </Link>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-rose-400 hover:bg-rose-950/40 transition-colors border-t border-slate-800"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
