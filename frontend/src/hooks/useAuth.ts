import { useState, useEffect } from 'react';
import { User } from '@/types';
import { apiClient } from '@/lib/apiClient';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<User>('/auth/me');
      setUser(response.data);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      delete apiClient.defaults.headers.common.Authorization;
      document.cookie = 'auth_token=; Max-Age=0; path=/';
      setUser(null);
      window.location.replace('/');
    }
  };

  return { user, setUser, loading, refetchUser: fetchUser, logout };
}

