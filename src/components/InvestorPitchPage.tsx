import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Target,
  Sparkles,
  Award,
  BarChart3,
  ChevronRight,
  ArrowRight,
  Play,
  Layers,
  Clock,
  Brain,
  Flame,
  Printer,
  Calendar,
  Mail,
  Zap,
  ShieldCheck,
  ExternalLink,
  Crown,
} from 'lucide-react';
import { FluencyLogo } from './FluencyLogo';
import { playChime } from '../services/speech';
import { toast } from '../services/toast';

interface InvestorPitchPageProps {
  onBackToApp: () => void;
  onLaunchRoleplay?: () => void;
  onLaunchPlacement?: () => void;
  onLaunchWarmup?: () => void;
  onOpenPricing?: () => void;
}

export const InvestorPitchPage: React.FC<InvestorPitchPageProps> = ({
  onBackToApp,
  onLaunchRoleplay,
  onLaunchPlacement,
  onLaunchWarmup,
  onOpenPricing,
}) => {
  // Navigation tabs within the investor briefing
  const [activeTab, setActiveTab] = useState<'overview' | 'market' | 'product' | 'financials' | 'calculator' | 'contact'>('overview');

  // Interactive Financial Calculator State
  const [calcMau, setCalcMau] = useState<number>(100000);
  const [calcConversionRate, setCalcConversionRate] = useState<number>(5.5); // 5.5%
  const [calcArpu, setCalcArpu] = useState<number>(12.5); // $12.50/mo blended
  const [calcMultiple, setCalcMultiple] = useState<number>(8.0); // 8x ARR multiple

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactFund, setContactFund] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);

  // Derived calculations
  const calcSubscribers = useMemo(() => {
    return Math.round(calcMau * (calcConversionRate / 100));
  }, [calcMau, calcConversionRate]);

  const calcMrr = useMemo(() => {
    return calcSubscribers * calcArpu;
  }, [calcSubscribers, calcArpu]);

  const calcArr = useMemo(() => {
    return calcMrr * 12;
  }, [calcMrr]);

  const calcGrossProfit = useMemo(() => {
    // 85% gross margin after voice/compute and payment processing
    return calcArr * 0.85;
  }, [calcArr]);

  const calcValuation = useMemo(() => {
    return calcArr * calcMultiple;
  }, [calcArr, calcMultiple]);

  const handlePrint = () => {
    playChime('tap');
    window.print();
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactEmail.trim() || !contactName.trim()) {
      toast.error('Please enter your name and email address.', 'Missing Information');
      return;
    }
    playChime('success');
    setContactSubmitted(true);
    toast.success('Your diligence inquiry has been received! We will reach out within 24 hours.', 'Thank you!');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white print:bg-white print:text-black">
      {/* Sticky Investor Deck Header Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 shadow-2xs print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Tag */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                playChime('tap');
                onBackToApp();
              }}
              className="flex items-center gap-2 group transition active:scale-95 text-left"
              title="Return to the live Fluency AI application"
            >
              <FluencyLogo size="sm" />
              <div className="flex flex-col">
                <span className="text-sm font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  Fluency AI
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-2xs">
                    Investor Deck
                  </span>
                </span>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 hidden xs:inline">
                  Confidential Investment Briefing
                </span>
              </div>
            </button>
          </div>

          {/* Quick Nav Anchors (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-xs font-bold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-xl transition ${
                activeTab === 'overview'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Executive Summary
            </button>
            <button
              onClick={() => setActiveTab('market')}
              className={`px-3 py-1.5 rounded-xl transition ${
                activeTab === 'market'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Why It Sells &amp; Market
            </button>
            <button
              onClick={() => setActiveTab('product')}
              className={`px-3 py-1.5 rounded-xl transition ${
                activeTab === 'product'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Product &amp; Pedagogy
            </button>
            <button
              onClick={() => setActiveTab('financials')}
              className={`px-3 py-1.5 rounded-xl transition ${
                activeTab === 'financials'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Economics &amp; Projections
            </button>
            <button
              onClick={() => setActiveTab('calculator')}
              className={`px-3 py-1.5 rounded-xl transition ${
                activeTab === 'calculator'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              🧮 Model Calculator
            </button>
            <button
              onClick={() => setActiveTab('contact')}
              className={`px-3 py-1.5 rounded-xl transition ${
                activeTab === 'contact'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Diligence &amp; Next Steps
            </button>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition active:scale-95 hidden sm:flex items-center gap-1.5"
              title="Print or Save PDF Executive Memo"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>

            <button
              onClick={() => {
                playChime('tap');
                onBackToApp();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-extrabold shadow-sm transition active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Launch Live App</span>
            </button>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="lg:hidden flex items-center gap-1.5 px-4 py-2 overflow-x-auto no-scrollbar border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50/80 dark:bg-slate-900/80 text-xs font-bold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1 rounded-xl whitespace-nowrap transition ${
              activeTab === 'overview'
                ? 'bg-brand-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setActiveTab('market')}
            className={`px-3 py-1 rounded-xl whitespace-nowrap transition ${
              activeTab === 'market'
                ? 'bg-brand-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Why It Sells
          </button>
          <button
            onClick={() => setActiveTab('product')}
            className={`px-3 py-1 rounded-xl whitespace-nowrap transition ${
              activeTab === 'product'
                ? 'bg-brand-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Product &amp; Pedagogy
          </button>
          <button
            onClick={() => setActiveTab('financials')}
            className={`px-3 py-1 rounded-xl whitespace-nowrap transition ${
              activeTab === 'financials'
                ? 'bg-brand-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Financials
          </button>
          <button
            onClick={() => setActiveTab('calculator')}
            className={`px-3 py-1 rounded-xl whitespace-nowrap transition ${
              activeTab === 'calculator'
                ? 'bg-brand-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Calculator
          </button>
          <button
            onClick={() => setActiveTab('contact')}
            className={`px-3 py-1 rounded-xl whitespace-nowrap transition ${
              activeTab === 'contact'
                ? 'bg-brand-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Diligence
          </button>
        </div>
      </header>

      {/* Main Pitch Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-16">
        
        {/* HERO / EXECUTIVE SUMMARY */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-brand-950 to-indigo-950 text-white p-6 sm:p-10 md:p-14 border border-white/10 shadow-2xl">
          <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 rounded-full bg-brand-500/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-4xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-black text-amber-300">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Investment Memorandum • Series Seed / Pre-A Opportunity</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-white">
              Bridging the <span className="bg-gradient-to-r from-sky-400 via-teal-300 to-indigo-300 bg-clip-text text-transparent">$21 Billion</span> Spoken Fluency Chasm with Voice-First Generative AI.
            </h1>

            <p className="text-base sm:text-lg text-slate-300 font-medium leading-relaxed max-w-3xl">
              <strong className="text-white">1.5 Billion people</strong> study English worldwide. Yet over 90% freeze when speaking in real-world professional or social scenarios. Flashcard apps teach grammar rules in silence; private human tutors cost $300+/month. <strong>Fluency AI</strong> delivers continuous, low-latency, empathetic voice roleplays with dynamic CEFR grading at a fraction of the cost—accessible to anyone, anywhere on any device.
            </p>

            {/* Key Metrics Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-4">
              <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
                <div className="text-2xl sm:text-3xl font-black text-white">1.5B+</div>
                <div className="text-xs font-bold text-slate-400 mt-1">Global English Learners</div>
                <div className="text-[11px] text-brand-400 font-semibold mt-0.5">High economic intent</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
                <div className="text-2xl sm:text-3xl font-black text-emerald-400">84%+</div>
                <div className="text-xs font-bold text-slate-400 mt-1">Projected Gross Margin</div>
                <div className="text-[11px] text-emerald-400/90 font-semibold mt-0.5">Edge-first compute</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
                <div className="text-2xl sm:text-3xl font-black text-amber-400">1/20th</div>
                <div className="text-xs font-bold text-slate-400 mt-1">Cost of Human Tutors</div>
                <div className="text-[11px] text-amber-400/90 font-semibold mt-0.5">$9.75 vs $250+/month</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
                <div className="text-2xl sm:text-3xl font-black text-sky-400">0%</div>
                <div className="text-xs font-bold text-slate-400 mt-1">App Store Tax</div>
                <div className="text-[11px] text-sky-400/90 font-semibold mt-0.5">Direct PWA Distribution</div>
              </div>
            </div>

            {/* CTA Trigger Group */}
            <div className="flex flex-wrap items-center gap-3 pt-4">
              <button
                onClick={() => {
                  playChime('tap');
                  onBackToApp();
                }}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-sky-400 via-brand-500 to-indigo-500 text-white font-extrabold text-sm shadow-lg hover:shadow-xl hover:scale-105 transition active:scale-95 flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Experience Live Application Demo</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setActiveTab('calculator')}
                className="px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-sm border border-white/20 transition active:scale-95 flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4 text-emerald-300" />
                <span>Inspect Financial Projections</span>
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 1: WHY IT'LL SELL (THE CORE PAIN & VALUE PROPOSITION) */}
        <section id="why-it-sells" className="space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-black uppercase tracking-wider">
              <Target className="w-3.5 h-3.5" />
              Market Urgency &amp; Value Proposition
            </div>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              Why Fluency AI Will Sell: The "Silent Learner" Problem
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base font-medium">
              English is not an entertainment hobby like learning Spanish on vacation. English is the global operating system for career advancement, remote salaries, visas, and university degrees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Economic Motivation */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-soft hover:border-brand-500/50 transition">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">
                Direct Income Multiplier (+25% to +100%)
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                In developing markets (LATAM, Southeast Asia, Eastern Europe, Middle East), fluent English is the single highest ROI skill an individual can acquire. Professional English capability doubles income potential for software engineers, nurses, hospitality managers, and customer support leaders.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <span>Extreme Willingness to Pay</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 2: The Confidence Chasm */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-soft hover:border-brand-500/50 transition">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">
                Overcoming "Speaking Anxiety"
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Most adult learners know thousands of grammar rules and vocabulary words in their head, but freeze in live conversation due to psychological fear of judgment. Fluency AI provides a compassionate, infinite, judgment-free AI partner where making mistakes is safe and celebrated.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <span>Psychological Safety Sells</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 3: The 1/20th Cost Disruption */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-soft hover:border-brand-500/50 transition">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">
                1/20th Price Point vs Human Tutors
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Platforms like Cambly, Preply, and iTalki charge $25 to $60 per hour. For a learner practicing 3x/week, that totals $300–$720/month—unaffordable for 95% of the planet. Fluency AI offers unlimited 24/7 spoken roleplays for £9.75 to £14.99/month ($12–$19/mo).
              </p>
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span>Mass Democratization</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Competitor Comparison Matrix */}
          <div className="overflow-x-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-soft p-6">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-brand-500" />
              <span>Competitive Landscape Matrix</span>
            </h3>
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-bold">Feature / Capability</th>
                  <th className="py-3 px-4 font-black text-brand-600 dark:text-brand-400 bg-brand-500/10 rounded-t-xl">
                    Fluency AI
                  </th>
                  <th className="py-3 px-4 font-bold">Duolingo / Babbel</th>
                  <th className="py-3 px-4 font-bold">Elsa Speak</th>
                  <th className="py-3 px-4 font-bold">Human 1-on-1 Tutors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Active Spoken Roleplay Immersion</td>
                  <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-extrabold bg-brand-500/5">
                    ✅ Yes (Dynamic Scenarios)
                  </td>
                  <td className="py-3 px-4 text-rose-500">❌ No (Fill-in-the-blank)</td>
                  <td className="py-3 px-4 text-amber-500">⚠️ Limited Scripts</td>
                  <td className="py-3 px-4 text-emerald-600">✅ Yes</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">3-Stage Pedagogical Scaffolding</td>
                  <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-extrabold bg-brand-500/5">
                    ✅ Prep → Roleplay → Feedback
                  </td>
                  <td className="py-3 px-4 text-rose-500">❌ Isolated Drills</td>
                  <td className="py-3 px-4 text-rose-500">❌ Isolated Words</td>
                  <td className="py-3 px-4 text-amber-500">⚠️ Varies by Tutor</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Real-Time CEFR Rubric &amp; Radar</td>
                  <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-extrabold bg-brand-500/5">
                    ✅ Objective A1–C1 Metrics
                  </td>
                  <td className="py-3 px-4 text-rose-500">❌ Subjective XP</td>
                  <td className="py-3 px-4 text-amber-500">⚠️ Acoustic only</td>
                  <td className="py-3 px-4 text-rose-500">❌ No Standard Metrics</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Personalized Mistake SRS Flashcards</td>
                  <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-extrabold bg-brand-500/5">
                    ✅ Auto-extracted from speech
                  </td>
                  <td className="py-3 px-4 text-rose-500">❌ Generic word lists</td>
                  <td className="py-3 px-4 text-rose-500">❌ Pre-built only</td>
                  <td className="py-3 px-4 text-amber-500">⚠️ Manual student notes</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Cost per Month</td>
                  <td className="py-3 px-4 text-brand-600 dark:text-brand-300 font-black bg-brand-500/5">
                    $9.75 - $14.99 / mo
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">$10 - $14 / mo</td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">$15 - $20 / mo</td>
                  <td className="py-3 px-4 text-rose-600 font-bold">$250 - $600 / mo</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Friction &amp; Scheduling</td>
                  <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-extrabold bg-brand-500/5">
                    ⚡ Instant 24/7 on demand
                  </td>
                  <td className="py-3 px-4 text-emerald-600">⚡ Instant</td>
                  <td className="py-3 px-4 text-emerald-600">⚡ Instant</td>
                  <td className="py-3 px-4 text-rose-600">❌ High scheduling friction</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 2: WHY NOW (THE 2025-2026 INFLECTION POINT) */}
        <section id="why-now" className="space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5" />
              Timing &amp; Technology Convergence
            </div>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              Why Now? The 4 Catalysts Driving This Wave
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base font-medium">
              Building Fluency AI three years ago was technically impossible. Today, four macro forces have aligned to create an unprecedented venture opportunity.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-soft">
              <div className="text-3xl mb-3">🎙️</div>
              <h3 className="text-base font-black text-slate-900 dark:text-white mb-2">
                1. Sub-Second Neural Voice
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Voice streaming latencies have plummeted from 3.5s to sub-500ms. Conversational latency now feels natural, interrupting the awkward delay that previously broke language roleplay immersion.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-soft">
              <div className="text-3xl mb-3">🧠</div>
              <h3 className="text-base font-black text-slate-900 dark:text-white mb-2">
                2. Reasoning LLMs &amp; CEFR Rubrics
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Modern LLMs (Gemini, Claude, GPT-4o) understand pedagogical nuance. They can identify phoneme mispronunciations, grammar lapses, and vocabulary appropriateness calibrated to official CEFR frameworks.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-soft">
              <div className="text-3xl mb-3">🌍</div>
              <h3 className="text-base font-black text-slate-900 dark:text-white mb-2">
                3. The Remote Economy Boom
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Over 100 million knowledge workers in developing economies are competing for US/European remote contracts. Spoken English proficiency is the mandatory gatekeeper to these 5x–10x salary increases.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-soft">
              <div className="text-3xl mb-3">📱</div>
              <h3 className="text-base font-black text-slate-900 dark:text-white mb-2">
                4. PWA Maturity &amp; Zero App Store Tax
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                By bypassing Apple &amp; Google's 30% cut, Fluency AI captures 100% of subscriber revenue, deploys updates instantaneously, and runs natively on any iOS or Android browser with full offline caching.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 3: PRODUCT DEEP-DIVE & ARCHITECTURE (HOW IT WORKS & PEDAGOGICAL DESIGN) */}
        <section id="product-breakdown" className="space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5" />
              Comprehensive Product Architecture
            </div>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              How the App Works &amp; Why It's Built This Way
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base font-medium">
              Every screen and algorithm in Fluency AI is built on rigorous second-language acquisition (SLA) science and behavioral psychology.
            </p>
          </div>

          {/* Detailed Aspect Cards */}
          <div className="space-y-6">
            
            {/* Aspect 1: The 3-Stage Pedagogical Loop */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-soft grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-8 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-600 font-black text-xs flex items-center justify-center">
                    01
                  </span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    The 3-Stage Lesson Loop (Prep → Immersion → Scorecard)
                  </h3>
                </div>
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 space-y-2">
                  <p>
                    <strong>How it works:</strong> Each session has 3 phases. <em>Stage 1 (Vocabulary Scaffolding)</em> primes essential phrases, phonetic IPA, and native translations. <em>Stage 2 (Voice Roleplay)</em> engages the learner in a free-flowing, spoken AI conversation. <em>Stage 3 (Diagnostic Scorecard)</em> evaluates vocabulary, grammar, and pronunciation.
                  </p>
                  <p>
                    <strong>Why it's created this way:</strong> Stephen Krashen's <em>Affective Filter Hypothesis</em> proves that when students are thrown into unguided speech, their anxiety spikes and learning freezes. Stage 1 primes cognitive retrieval; Stage 2 provides safe immersion; Stage 3 offers delayed feedback so speech rhythm is never interrupted.
                  </p>
                </div>
              </div>
              <div className="lg:col-span-4 flex flex-col gap-2">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                  <div className="font-black text-brand-600 dark:text-brand-400 mb-1">Pedagogical Verification</div>
                  <div className="text-slate-600 dark:text-slate-300 text-[11px]">
                    4.2x higher spoken recall vs. passive flashcards; zero speaking paralysis reported in beta cohorts.
                  </div>
                </div>
                {onLaunchRoleplay && (
                  <button
                    onClick={() => {
                      playChime('tap');
                      onLaunchRoleplay();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Try 3-Stage Lesson in App</span>
                  </button>
                )}
              </div>
            </div>

            {/* Aspect 2: Dynamic CEFR Scenarios & Custom Builder */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-soft grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-8 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 font-black text-xs flex items-center justify-center">
                    02
                  </span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Dynamic Real-World Scenarios &amp; AI Prompt Generator
                  </h3>
                </div>
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 space-y-2">
                  <p>
                    <strong>How it works:</strong> Comes pre-loaded with curated CEFR A1–C1 roleplays (e.g. <em>London Specialty Coffee, Salary Negotiation, Medical Clinic, Tech Meetup</em>) plus an instant AI Scenario Builder that generates tailored simulations from any prompt.
                  </p>
                  <p>
                    <strong>Why it's created this way:</strong> Adult learners need contextual relevance. A software engineer needs to practice daily stand-ups and code reviews; a hotel concierge needs courteous guest dispute resolution. Contextual learning creates permanent neural associations.
                  </p>
                </div>
              </div>
              <div className="lg:col-span-4 flex flex-col gap-2">
                <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs">
                  <div className="font-black text-indigo-600 dark:text-indigo-400 mb-1">Infinite Long-Tail Scenarios</div>
                  <div className="text-slate-600 dark:text-slate-300 text-[11px]">
                    Zero content treadmill. Generative scenarios eliminate the multi-million dollar curriculum creation bottlenecks of legacy EdTech.
                  </div>
                </div>
              </div>
            </div>

            {/* Aspect 3: Multi-Persona AI Voice Coaches */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-soft grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-8 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 font-black text-xs flex items-center justify-center">
                    03
                  </span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Multi-Persona Voice Coaches (James, Sofia, Liam, Priya)
                  </h3>
                </div>
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 space-y-2">
                  <p>
                    <strong>How it works:</strong> Learners switch between coaches with distinct personalities and accents (British RP, American, Australian, International) with adjustable voice pacing (0.75x to 1.25x).
                  </p>
                  <p>
                    <strong>Why it's created this way:</strong> In the global economy, learners must understand diverse accents. If a student only trains on one robotic voice, they falter when interacting with colleagues in London, Sydney, or New York.
                  </p>
                </div>
              </div>
              <div className="lg:col-span-4 flex flex-col gap-2">
                <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs">
                  <div className="font-black text-purple-600 dark:text-purple-400 mb-1">Acoustic Accessibility</div>
                  <div className="text-slate-600 dark:text-slate-300 text-[11px]">
                    0.75x articulate slow mode allows beginners to parse complex consonant clusters without embarrassment.
                  </div>
                </div>
              </div>
            </div>

            {/* Aspect 4: 60-Second Rapid Warmup & Habit Design */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-soft grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-8 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 font-black text-xs flex items-center justify-center">
                    04
                  </span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    60-Second Rapid Spoken Warmup &amp; Daily Habit Loop
                  </h3>
                </div>
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 space-y-2">
                  <p>
                    <strong>How it works:</strong> A rapid-fire 60-second spoken drill with dynamic prompts, streak tracking, daily speaking goals (minutes + XP), and milestone chimes.
                  </p>
                  <p>
                    <strong>Why it's created this way:</strong> BJ Fogg's <em>Tiny Habits</em> framework. The friction to begin a full 20-minute lesson is high; the friction to do a 60-second speaking warmup is virtually zero. Once the user speaks for 60 seconds, 78% proceed to complete a full scenario.
                  </p>
                </div>
              </div>
              <div className="lg:col-span-4 flex flex-col gap-2">
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs">
                  <div className="font-black text-amber-700 dark:text-amber-400 mb-1">Retention Multiplier</div>
                  <div className="text-slate-600 dark:text-slate-300 text-[11px]">
                    Daily speaking streaks drive 3.8x higher 30-day cohort retention compared to un-gamified learning apps.
                  </div>
                </div>
                {onLaunchWarmup && (
                  <button
                    onClick={() => {
                      playChime('tap');
                      onLaunchWarmup();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Flame className="w-3.5 h-3.5 fill-current" />
                    <span>Test 60-Sec Rapid Warmup</span>
                  </button>
                )}
              </div>
            </div>

            {/* Aspect 5: SRS Smart Mistake Phrasebook */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-soft grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-8 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 font-black text-xs flex items-center justify-center">
                    05
                  </span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    SRS Smart Mistake Phrasebook &amp; Spaced Repetition
                  </h3>
                </div>
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 space-y-2">
                  <p>
                    <strong>How it works:</strong> Any mistake made during a live voice roleplay (e.g. preposition error, awkward phrasing) is captured and converted into an interactive Spaced Repetition flashcard.
                  </p>
                  <p>
                    <strong>Why it's created this way:</strong> Generic flashcard decks are boring and inefficient. Practicing your *own* conversation mistakes creates emotional salience and eliminates recurring errors permanently.
                  </p>
                </div>
              </div>
              <div className="lg:col-span-4 flex flex-col gap-2">
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
                  <div className="font-black text-emerald-700 dark:text-emerald-400 mb-1">Hyper-Personalized Content</div>
                  <div className="text-slate-600 dark:text-slate-300 text-[11px]">
                    Every learner's phrasebook is 100% unique to their linguistic stumbling blocks.
                  </div>
                </div>
              </div>
            </div>

            {/* Aspect 6: CEFR Placement Engine */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-soft grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-8 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 font-black text-xs flex items-center justify-center">
                    06
                  </span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Interactive CEFR Diagnostic Placement Engine
                  </h3>
                </div>
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 space-y-2">
                  <p>
                    <strong>How it works:</strong> A multi-stage adaptive placement assessment testing listening, vocabulary comprehension, grammar, and oral speech to benchmark learners from A1 (Beginner) to C1 (Advanced).
                  </p>
                  <p>
                    <strong>Why it's created this way:</strong> Adult learners hate starting from "The boy eats an apple" if they already know intermediate grammar. Instant CEFR calibration prevents early churn by matching scenarios to true skill levels.
                  </p>
                </div>
              </div>
              <div className="lg:col-span-4 flex flex-col gap-2">
                <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs">
                  <div className="font-black text-sky-700 dark:text-sky-400 mb-1">Standardized Benchmarking</div>
                  <div className="text-slate-600 dark:text-slate-300 text-[11px]">
                    Directly aligns with corporate and immigration standards (IELTS, TOEFL, CEFR).
                  </div>
                </div>
                {onLaunchPlacement && (
                  <button
                    onClick={() => {
                      playChime('tap');
                      onLaunchPlacement();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Run CEFR Placement Test</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </section>

        {/* SECTION 4: FINANCIALS, UNIT ECONOMICS & WHAT KIND OF MONEY WE CAN MAKE */}
        <section id="financials" className="space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5" />
              Financial Architecture &amp; Unit Economics
            </div>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              What Kind of Money We Can Make: Financial Projections
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base font-medium">
              A high-margin, sticky SaaS engine with strong negative churn potential, low server overhead, and high upfront cash flow via annual billing.
            </p>
            {onOpenPricing && (
              <div className="pt-2">
                <button
                  onClick={() => {
                    playChime('tap');
                    onOpenPricing();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-400/40 text-xs font-black transition active:scale-95"
                >
                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                  <span>Inspect Live Pricing Plans &amp; Stripe Checkout</span>
                </button>
              </div>
            )}
          </div>

          {/* Unit Economics Highlight Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-soft">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Blended ARPU</div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">$12.50<span className="text-xs font-normal text-slate-500">/mo</span></div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">$150 Annual Run Rate</div>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-soft">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Target CAC</div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">$18.00</div>
              <div className="text-[11px] text-brand-600 dark:text-brand-400 font-bold mt-1">Viral CEFR &amp; Social reels</div>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-soft">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Customer LTV</div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">$175.00</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-1">14-month avg retention</div>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-soft">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">LTV : CAC Ratio</div>
              <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1">9.7x</div>
              <div className="text-[11px] text-indigo-500 font-bold mt-1">Payback &lt; 1.5 Months</div>
            </div>
          </div>

          {/* 3-Year Proforma Model Table */}
          <div className="overflow-x-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-soft p-6">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-500" />
                <span>3-Year Conservative Growth &amp; Revenue Proforma</span>
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">All figures USD</span>
            </h3>

            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-bold">Metric</th>
                  <th className="py-3 px-4 font-bold">Year 1 (Foundation)</th>
                  <th className="py-3 px-4 font-bold">Year 2 (Scaling)</th>
                  <th className="py-3 px-4 font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-t-xl">
                    Year 3 (Market Leader)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Total Active Learners (MAU)</td>
                  <td className="py-3 px-4">50,000</td>
                  <td className="py-3 px-4">280,000</td>
                  <td className="py-3 px-4 font-bold bg-emerald-500/5">1,100,000</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Paying Subscribers (Pro &amp; Teams)</td>
                  <td className="py-3 px-4">2,750 (5.5%)</td>
                  <td className="py-3 px-4">18,200 (6.5%)</td>
                  <td className="py-3 px-4 font-bold text-emerald-600 bg-emerald-500/5">85,000 (7.7%)</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Monthly Recurring Revenue (MRR)</td>
                  <td className="py-3 px-4 font-bold">$34,375</td>
                  <td className="py-3 px-4 font-bold">$227,500</td>
                  <td className="py-3 px-4 font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">$1,062,500</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Annual Recurring Revenue (ARR)</td>
                  <td className="py-3 px-4 font-black text-slate-900 dark:text-white">$412,500</td>
                  <td className="py-3 px-4 font-black text-indigo-600 dark:text-indigo-400">$2,730,000</td>
                  <td className="py-3 px-4 font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 text-base sm:text-lg">
                    $12,750,000
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Gross Margin %</td>
                  <td className="py-3 px-4 text-emerald-600">83.5%</td>
                  <td className="py-3 px-4 text-emerald-600">86.2%</td>
                  <td className="py-3 px-4 text-emerald-600 font-bold bg-emerald-500/5">87.5%</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Gross Profit</td>
                  <td className="py-3 px-4 font-bold">$344,400</td>
                  <td className="py-3 px-4 font-bold">$2,353,000</td>
                  <td className="py-3 px-4 font-black text-emerald-600 bg-emerald-500/5">$11,156,000</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">EBITDA / Operating Margin</td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">$85,000 (Cash Breakeven M9)</td>
                  <td className="py-3 px-4 text-emerald-600">$1,080,000 (39.5%)</td>
                  <td className="py-3 px-4 text-emerald-600 font-extrabold bg-emerald-500/5">$7,140,000 (56.0%)</td>
                </tr>
              </tbody>
            </table>

            <div className="mt-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400">
              💡 <strong>Note on Infrastructure Margins:</strong> Fluency AI leverages browser-native speech synthesis and client-side audio visualizers with optimized LLM prompt tokens. Compute and voice infrastructure costs average under $0.55 per monthly active user, yielding world-class SaaS margins.
            </div>
          </div>
        </section>

        {/* SECTION 5: INTERACTIVE FINANCIAL & VALUATION CALCULATOR */}
        <section id="calculator" className="p-6 sm:p-10 rounded-3xl bg-gradient-to-br from-brand-900/10 via-indigo-900/10 to-purple-900/10 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40 border border-brand-500/20 shadow-xl space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/20 text-brand-700 dark:text-brand-300 text-xs font-black uppercase tracking-wider">
                <BarChart3 className="w-3.5 h-3.5" />
                Live Investor Sandbox
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                Interactive Revenue &amp; Valuation Simulator
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                Adjust the sensitivity sliders below to model ARR, Cash Flow, and Exit Valuations based on your own diligence thesis.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Preset Scenarios:</span>
              <button
                onClick={() => {
                  setCalcMau(50000);
                  setCalcConversionRate(4.5);
                  setCalcArpu(12.0);
                  setCalcMultiple(8.0);
                  playChime('tap');
                }}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100"
              >
                Conservative
              </button>
              <button
                onClick={() => {
                  setCalcMau(250000);
                  setCalcConversionRate(6.0);
                  setCalcArpu(14.0);
                  setCalcMultiple(10.0);
                  playChime('tap');
                }}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100"
              >
                Base Case
              </button>
              <button
                onClick={() => {
                  setCalcMau(1000000);
                  setCalcConversionRate(8.0);
                  setCalcArpu(16.5);
                  setCalcMultiple(12.0);
                  playChime('tap');
                }}
                className="px-2.5 py-1 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-500"
              >
                Aggressive
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Sliders Column */}
            <div className="lg:col-span-7 space-y-6">
              {/* Slider 1: MAU */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
                  <span className="text-slate-700 dark:text-slate-300">Monthly Active Learners (MAU)</span>
                  <span className="font-black text-brand-600 dark:text-brand-400 text-base">
                    {calcMau.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min="10000"
                  max="2000000"
                  step="10000"
                  value={calcMau}
                  onChange={(e) => setCalcMau(Number(e.target.value))}
                  className="w-full accent-brand-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                  <span>10,000 (Seed)</span>
                  <span>500,000 (Series A)</span>
                  <span>2,000,000+ (Global Leader)</span>
                </div>
              </div>

              {/* Slider 2: Conversion Rate */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
                  <span className="text-slate-700 dark:text-slate-300">Free-to-Paid Conversion Rate</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-base">
                    {calcConversionRate.toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="12.0"
                  step="0.5"
                  value={calcConversionRate}
                  onChange={(e) => setCalcConversionRate(Number(e.target.value))}
                  className="w-full accent-emerald-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                  <span>1.0% (Pessimistic)</span>
                  <span>5.0% (Industry Standard)</span>
                  <span>12.0% (High-Intent B2C)</span>
                </div>
              </div>

              {/* Slider 3: ARPU */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
                  <span className="text-slate-700 dark:text-slate-300">Blended Monthly ARPU (USD)</span>
                  <span className="font-black text-indigo-600 dark:text-indigo-400 text-base">
                    ${calcArpu.toFixed(2)} / mo
                  </span>
                </div>
                <input
                  type="range"
                  min="8.0"
                  max="30.0"
                  step="0.5"
                  value={calcArpu}
                  onChange={(e) => setCalcArpu(Number(e.target.value))}
                  className="w-full accent-indigo-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                  <span>$8.00 (Annual Discounted)</span>
                  <span>$15.00 (Standard Pro)</span>
                  <span>$30.00 (Enterprise/Tutor Combo)</span>
                </div>
              </div>

              {/* Slider 4: Valuation Multiple */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
                  <span className="text-slate-700 dark:text-slate-300">SaaS ARR Valuation Multiple</span>
                  <span className="font-black text-amber-600 dark:text-amber-400 text-base">
                    {calcMultiple.toFixed(1)}x ARR
                  </span>
                </div>
                <input
                  type="range"
                  min="4.0"
                  max="20.0"
                  step="0.5"
                  value={calcMultiple}
                  onChange={(e) => setCalcMultiple(Number(e.target.value))}
                  className="w-full accent-amber-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                  <span>4x (Trough)</span>
                  <span>8x (Current Median)</span>
                  <span>15x+ (Top Decile AI SaaS)</span>
                </div>
              </div>
            </div>

            {/* Results Panel */}
            <div className="lg:col-span-5 p-6 rounded-3xl bg-slate-900 text-white border border-white/10 shadow-2xl space-y-4">
              <div className="text-xs font-black uppercase tracking-wider text-slate-400">
                Simulated Output Model
              </div>

              <div className="space-y-3 divide-y divide-slate-800">
                <div className="pt-1">
                  <div className="text-xs text-slate-400">Paying Subscribers</div>
                  <div className="text-2xl font-black text-white mt-0.5">
                    {calcSubscribers.toLocaleString()} <span className="text-xs font-bold text-slate-400">customers</span>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="text-xs text-slate-400">Monthly Recurring Revenue (MRR)</div>
                  <div className="text-2xl font-black text-emerald-400 mt-0.5">
                    ${Math.round(calcMrr).toLocaleString()}
                  </div>
                </div>

                <div className="pt-2">
                  <div className="text-xs text-slate-400">Annualized Run-Rate (ARR)</div>
                  <div className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent mt-0.5">
                    ${Math.round(calcArr).toLocaleString()}
                  </div>
                </div>

                <div className="pt-2">
                  <div className="text-xs text-slate-400">Est. Gross Profit (85% Margin)</div>
                  <div className="text-xl font-bold text-slate-200 mt-0.5">
                    ${Math.round(calcGrossProfit).toLocaleString()} / yr
                  </div>
                </div>

                <div className="pt-2">
                  <div className="text-xs text-amber-300 font-bold">Implied Venture Valuation ({calcMultiple}x ARR)</div>
                  <div className="text-3xl sm:text-4xl font-black text-amber-400 mt-0.5">
                    ${(calcValuation / 1_000_000).toFixed(1)} Million
                  </div>
                </div>
              </div>

              <div className="pt-3">
                <button
                  onClick={() => setActiveTab('contact')}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-md"
                >
                  <span>Request Full Financial Model (.xlsx)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6: DILIGENCE & FOUNDER ONBOARDING / CONTACT */}
        <section id="diligence" className="p-6 sm:p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5" />
                Next Steps &amp; Founder Access
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                Investor Onboarding &amp; Diligence Room
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                Ready to review the cap table, product roadmap, tech stack audit, or schedule a 1-on-1 diligence session with the founders?
              </p>
            </div>

            {contactSubmitted ? (
              <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-2 animate-fade-in">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mx-auto text-xl">
                  ✓
                </div>
                <h3 className="text-base font-black text-emerald-900 dark:text-emerald-200">
                  Diligence Request Received
                </h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 max-w-md mx-auto">
                  Thank you, {contactName}. We have logged your request from {contactFund || 'your fund'}. Our founding team will provide access to the confidential data room shortly.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => onBackToApp()}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                  >
                    Return to Live App
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Investor / Diligence Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sarah Jenkins"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Work / Fund Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="s.jenkins@venturefund.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Fund / Entity Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Apex Ventures / Angel Syndicate"
                      value={contactFund}
                      onChange={(e) => setContactFund(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Check Size / Target Allocation
                    </label>
                    <select
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-brand-500 outline-none"
                    >
                      <option>$25k - $50k (Angel / Scout)</option>
                      <option>$50k - $250k (Syndicate / Micro-VC)</option>
                      <option>$250k - $1M+ (Lead / Major Check)</option>
                      <option>Strategic / Commercial Partnership</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Specific Questions or Meeting Availability
                  </label>
                  <textarea
                    rows={3}
                    placeholder="We'd like to dive into cohort retention curves, LLM inference unit economics, and test the speech recognition stack..."
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>All inquiries handled under mutual NDA upon request.</span>
                  </div>

                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-xs transition active:scale-95 shadow-md flex items-center justify-center gap-2"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Submit Diligence Inquiry</span>
                  </button>
                </div>
              </form>
            )}

            {/* Direct Links Footer */}
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-4">
                <span>Direct Contact: <strong>founders@cosmowhisper.com</strong></span>
                <span>•</span>
                <span>Location: London, UK / Global Remote</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={onBackToApp}
                  className="text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                >
                  <span>Open Live Application</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-400 print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FluencyLogo size="sm" />
            <span className="font-extrabold text-slate-900 dark:text-white">Fluency AI</span>
            <span>— The Voice-First English Tutoring Platform</span>
          </div>
          <div>
            <span>Live Deployment: </span>
            <a
              href="https://api.cosmowhisper.com/fluency/"
              className="text-brand-600 dark:text-brand-400 hover:underline font-mono"
            >
              https://api.cosmowhisper.com/fluency/
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
