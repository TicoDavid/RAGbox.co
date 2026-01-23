"use client";
import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import Hero from '@/components/Hero';
import { PrivilegeCards } from '@/components/PrivilegeCards';
import { AuthModal } from '@/components/AuthModal';

export default function Home() {
  const [isAuthOpen, setAuthOpen] = useState(false);
  const openAuth = () => setAuthOpen(true);

  return (
    <main className="min-h-screen dark:bg-[#050505] bg-white transition-colors duration-300">
      <Navbar onOpenAuth={openAuth} />
      <Hero onOpenAuth={openAuth} />
      <PrivilegeCards />
      <AuthModal isOpen={isAuthOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}
