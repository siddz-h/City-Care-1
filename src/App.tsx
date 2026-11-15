import React, { useState } from 'react';
import { FontScale } from './types';
import { ElderlyCareHub } from './components/ElderlyCareHub';
import { Plus } from 'lucide-react';

export default function App() {
  const [activeSection, setActiveSection] = useState<
    'overview' | 'medications' | 'appointments' | 'assistant' | 'care_circle'
  >('overview');
  const [fontScale, setFontScale] = useState<FontScale>('normal');
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const [openAddMedModalTrigger, setOpenAddMedModalTrigger] = useState<number>(0);

  const navItems: {
    id: 'overview' | 'medications' | 'appointments' | 'assistant' | 'care_circle';
    label: string;
  }[] = [
    { id: 'overview', label: 'Care Overview' },
    { id: 'medications', label: 'Medications' },
    { id: 'appointments', label: 'Appointments' },
    { id: 'assistant', label: 'Smart Assistant' },
    { id: 'care_circle', label: 'Care Circle' },
  ];

  return (
    <div
      className={`min-h-screen flex flex-col ${
        highContrast ? 'bg-black text-white' : 'text-slate-900'
      }`}
    >
      {/* WCAG 2.1 AA/AAA Skip to Main Content Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-[#0F172A] focus:text-[#A3E635] focus:font-extrabold"
      >
        Skip to main content
      </a>

      {/* Strict 3-Zone Top Navigation Bar + Responsive Mobile Nav */}
      <header
        role="banner"
        className={`sticky top-0 z-30 border-b ${
          highContrast
            ? 'bg-black border-yellow-400 text-white'
            : 'glass-header border-slate-200/80'
        }`}
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#main-content"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('overview');
            }}
            className="text-lg sm:text-xl font-extrabold tracking-tight whitespace-nowrap shrink-0"
          >
            SilverCare
          </a>

          {/* Zone 2: 5 Concise Single-Line Navigation Links (Desktop) */}
          <nav
            aria-label="Primary Elderly Care Navigation"
            className="hidden md:flex items-center gap-6 text-sm font-semibold"
          >
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActiveSection(item.id)}
                  className={`py-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 border-b-2 ${
                    isActive
                      ? highContrast
                        ? 'border-yellow-400 text-yellow-300 font-extrabold'
                        : 'border-blue-600 text-blue-700 font-extrabold'
                      : highContrast
                      ? 'border-transparent text-slate-200 hover:text-white'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action Button */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setOpenAddMedModalTrigger((prev) => prev + 1)}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-[#A3E635] text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Add Medication</span>
            </button>
          </div>
        </div>

        {/* Responsive Mobile & Small-Tablet Navigation Strip */}
        <nav
          aria-label="Mobile Elderly Care Navigation"
          className={`md:hidden border-t overflow-x-auto ${
            highContrast ? 'border-yellow-400/50 bg-black' : 'border-slate-200/70 bg-white/80'
          }`}
        >
          <div className="px-4 py-2 flex items-center gap-2 min-w-max">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActiveSection(item.id)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? highContrast
                        ? 'bg-yellow-400 text-black'
                        : 'bg-[#0F172A] text-[#A3E635]'
                      : highContrast
                      ? 'bg-white/10 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Main Content Landmark */}
      <main
        id="main-content"
        role="main"
        className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-8 lg:px-12 py-8 sm:py-10"
      >
        <ElderlyCareHub
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          fontScale={fontScale}
          onChangeFontScale={setFontScale}
          highContrast={highContrast}
          onToggleHighContrast={() => setHighContrast((prev) => !prev)}
          openAddMedModalTrigger={openAddMedModalTrigger}
        />
      </main>

      {/* Clean Minimal Footer */}
      <footer
        role="contentinfo"
        className="mt-auto border-t border-slate-200/80 glass-header py-5 text-xs text-slate-600"
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-extrabold text-slate-900">SilverCare</span>
            <span aria-hidden="true"> · </span>
            <span>Elderly Care &amp; Medication Management Platform</span>
          </div>
          <div>
            <span>Shared Passcode Care Circle · Proactive Email Reminders · Senior Autonomy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
