"use client";

import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist';

export default function Dashboard() {
  const { status } = useSession();

  // Mark this browser as having a verified user so returning visitors
  // skip the beta access code gate on the login modal.
  useEffect(() => {
    if (status === 'authenticated') {
      try { localStorage.setItem('ragbox_user_verified', '1'); } catch { /* SSR / private browsing */ }
    }
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-primary)]">
        <div className="animate-pulse text-[var(--text-tertiary)] font-mono text-sm">
          Initializing session...
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') redirect('/');

  return (
    <>
      <DashboardLayout />
      <OnboardingChecklist />
    </>
  );
}
