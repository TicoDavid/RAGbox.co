"use client";

import React from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist';

export default function Dashboard() {
  const { status } = useSession();

  if (status === 'unauthenticated') redirect('/');

  return (
    <>
      <DashboardLayout />
      <OnboardingChecklist />
    </>
  );
}
