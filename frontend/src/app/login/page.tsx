'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { AuthModal } from '@/components/auth/AuthModal';

export default function DedicatedLoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [modalOpen, setModalOpen] = useState(true);

  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-[#f4f6ff] flex items-center justify-center p-6">
      <AuthModal
        isOpen={modalOpen}
        onClose={() => router.push('/')}
        initialMode="login"
      />
    </div>
  );
}
