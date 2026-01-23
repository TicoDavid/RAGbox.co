"use client";
import React from 'react';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#050505] pt-16 pb-8 text-sm transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          {/* COLUMN 1: BRAND */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            {/* Theme-aware Logo */}
            <div className="flex items-center gap-2 font-bold text-xl">
              {/* Light mode: Black logo */}
              <img
                src="https://storage.googleapis.com/connexusai-assets/Primary_RagBoxCo_Colored_Black.png"
                className="h-8 w-auto dark:hidden"
                alt="RAGBox"
              />
              {/* Dark mode: White logo */}
              <img
                src="https://storage.googleapis.com/connexusai-assets/Primary_RagBoxCo_Colored_white.jpg"
                className="h-8 w-auto hidden dark:block"
                alt="RAGBox"
              />
            </div>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Sovereign Document Intelligence for the Enterprise. SOC2 Ready. Zero Retention.
            </p>
            <div className="flex gap-4">
              {/* Social Placeholders */}
              <SocialIcon path="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
              <SocialIcon path="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" circle />
            </div>
          </div>

          {/* COLUMN 2: PRODUCT */}
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-4">Product</h4>
            <ul className="space-y-3 text-slate-600 dark:text-slate-400">
              <FooterLink>Intelligence Engine</FooterLink>
              <FooterLink>Security Architecture</FooterLink>
              <FooterLink>Enterprise Connectors</FooterLink>
              <FooterLink>Pricing</FooterLink>
            </ul>
          </div>

          {/* COLUMN 3: COMPANY */}
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-4">Company</h4>
            <ul className="space-y-3 text-slate-600 dark:text-slate-400">
              <FooterLink>About Us</FooterLink>
              <FooterLink>Careers</FooterLink>
              <FooterLink>Legal</FooterLink>
              <FooterLink>Contact</FooterLink>
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
          <p>© 2024 ConnexUS AI. All rights reserved.</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Helpers
function FooterLink({ children }: { children: React.ReactNode }) {
  return (
    <li>
      <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
        {children}
      </a>
    </li>
  );
}

function SocialIcon({ path, circle }: { path: string, circle?: boolean }) {
  return (
    <a href="#" className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:bg-blue-600 hover:text-white transition-all">
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        {circle && <circle cx="4" cy="4" r="2"></circle>}
        <path d={path}></path>
      </svg>
    </a>
  );
}
