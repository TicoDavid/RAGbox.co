"use client";

import React, { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist';

export default function Dashboard() {
  const { status } = useSession();
  const redeemed = useRef(false);

  // Redeem beta code after OAuth success (one-time)
  useEffect(() => {
    if (status !== 'authenticated' || redeemed.current) return;
    redeemed.current = true;

    const code = typeof window !== 'undefined'
      ? sessionStorage.getItem('ragbox_beta_code')
      : null;

    if (!code) return;

    fetch('/api/beta/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(() => sessionStorage.removeItem('ragbox_beta_code'))
      .catch(() => { /* non-fatal — code stays in sessionStorage for retry */ });
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
