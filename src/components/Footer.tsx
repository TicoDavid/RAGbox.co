// THEME-EXEMPT: Public landing page, locked to Cobalt palette
// P05-HOTFIX: FIX-1 (dead links), FIX-2 (dead socials removed), FIX-5 (logo comment), FIX-7 (img→Image)
"use client";
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-amber-500/10 bg-white dark:bg-[#020408] pt-16 pb-8 text-sm transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          {/* COLUMN 1: BRAND */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            <div className="flex items-center gap-2 font-bold text-xl">
              <Image
                src="https://storage.googleapis.com/connexusai-assets/BabyBlue_RAGb%C3%B6x.png"
                className="h-24 w-auto"
                alt="RAGbox"
                width={360}
                height={96}
                priority
              />
            </div>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Sovereign Document Intelligence for the Enterprise. SOC2 Ready. Zero Retention.
            </p>
          </div>

          {/* COLUMN 2: PRODUCT */}
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-4">Product</h4>
            <ul className="space-y-3 text-slate-600 dark:text-slate-400">
              <li>Intelligence Engine</li>
              <li>Security Architecture</li>
              <li>Enterprise Connectors</li>
              <li>
                <Link href="/pricing" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* COLUMN 3: COMPANY */}
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-4">Company</h4>
            <ul className="space-y-3 text-slate-600 dark:text-slate-400">
              <li>About Us</li>
              <li>Careers</li>
              <li>Legal</li>
              <li>
                <a href="mailto:david@theconnexus.ai" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* COLUMN 4: STATUS */}
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-4">System Status</h4>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">All Systems Operational</span>
            </div>
          </div>
        </div>

        {/* BOTTOM BAR */}
        <div className="pt-8 border-t border-slate-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
          <p>&copy; 2026 ConnexUS AI Inc. All rights reserved.</p>
          <div className="flex gap-8">
            <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">Security</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
