"use client";

import React, { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist';
import { useMercuryStore } from '@/stores/mercuryStore';

export default function Dashboard() {
  const { status, data: session } = useSession();
  const previousUserIdRef = useRef<string | undefined>(undefined);

  // Multi-tenant fix: detect session user changes (User A → User B)
  // and clear all client-side state so the new user starts fresh.
  useEffect(() => {
    const currentUserId = (session?.user as { id?: string } | undefined)?.id;

    if (previousUserIdRef.current && currentUserId &&
        previousUserIdRef.current !== currentUserId) {
      // User ID changed while authenticated — clear all stores
      useMercuryStore.getState().clearConversation();
      try {
        localStorage.removeItem('ragbox-vault');
        localStorage.removeItem('ragbox-privilege');
        localStorage.removeItem('ragbox-chat-storage');
      } catch { /* SSR / private browsing */ }
      console.warn('[Dashboard] Session user changed, cleared stores', {
        from: previousUserIdRef.current,
        to: currentUserId,
      });
    }

    previousUserIdRef.current = currentUserId;
  }, [session]);

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
