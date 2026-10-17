import React, { useState } from 'react';
import {
  X,
  Check,
  Sparkles,
  Crown,
  ShieldCheck,
  CreditCard,
  Lock,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Star,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import {
  stripeService,
  detectCardBrand,
  formatCardNumberInput,
  formatExpiryInput,
} from '../services/stripeService';
import logoMark from '../assets/logo-mark.png';
import type {
  SubscriptionPlanTier,
  SubscriptionBillingCycle,
  StripePaymentMethod,
} from '../types';
import { playChime } from '../services/speech';
import { toast } from '../services/toast';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (plan: SubscriptionPlanTier) => void;
}

type Currency = 'GBP' | 'USD' | 'EUR';

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
};

const PLAN_PRICES = {
  GBP: {
    monthly: 14.99,
    annualMonthly: 9.75, // £117/yr
    annualTotal: 117.0,
    lifetime: 199.0,
  },
  USD: {
    monthly: 18.99,
    annualMonthly: 12.25, // $147/yr
    annualTotal: 147.0,
    lifetime: 249.0,
  },
  EUR: {
    monthly: 16.99,
    annualMonthly: 10.99, // €131/yr
    annualTotal: 131.0,
    lifetime: 229.0,
  },
};

const FAQS = [
  {
    q: 'Can I cancel or change my plan anytime?',
    a: 'Absolutely. You can manage or cancel your subscription with a single click inside your Profile > Billing tab at any time without fees or questions.',
  },
  {
    q: 'How does the Stripe checkout work?',
    a: 'Payments are processed securely via Stripe with 256-bit bank-grade encryption. We never store raw card numbers on our servers.',
  },
  {
    q: 'What is included in the Lifetime Mastery tier?',
    a: 'Lifetime Mastery gives you permanent, unlimited access to all FluencyAI Pro features forever, plus priority AI gateway tokens and all upcoming future coaches.',
  },
  {
    q: 'Does FluencyAI work offline?',
    a: 'Yes! Pro users have full offline access to cached roleplay scenarios, pronunciation drills, and SRS review decks.',
  },
];

export const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [currency, setCurrency] = useState<Currency>('GBP');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanTier>('pro');
  const [showCheckout, setShowCheckout] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Stripe Checkout Form State
  const [savedCards] = useState<StripePaymentMethod[]>(() =>
    stripeService.getPaymentMethods()
  );
  const [selectedCardId, setSelectedCardId] = useState<string>(
    () => savedCards.find((c) => c.isDefault)?.id || savedCards[0]?.id || 'new'
  );
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newCardExp, setNewCardExp] = useState('');
  const [newCardCvc, setNewCardCvc] = useState('');
  const [newCardName, setNewCardName] = useState('Alex Morgan');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const symbol = CURRENCY_SYMBOLS[currency];
  const prices = PLAN_PRICES[currency];

  const handleSelectPlan = (tier: SubscriptionPlanTier) => {
    playChime('tap');
    if (tier === 'free') {
      toast.info('You are already on the Free Starter plan.', 'Free Plan Active');
      return;
    }
    setSelectedPlan(tier);
    setShowCheckout(true);
  };

  const handleProcessCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    playChime('tap');

    try {
      let paymentMethodId = selectedCardId;

      if (selectedCardId === 'new') {
        const cleanNumber = newCardNumber.replace(/\D/g, '');
        if (cleanNumber.length < 13) {
          throw new Error('Please enter a valid card number');
        }
        const cleanExp = newCardExp.replace(/\D/g, '');
        if (cleanExp.length < 4) {
          throw new Error('Please enter expiration month and year (MM/YY)');
        }
        const expMonth = parseInt(cleanExp.slice(0, 2), 10);
        const expYear = parseInt(`20${cleanExp.slice(2, 4)}`, 10);

        const newMethod = await stripeService.addPaymentMethod({
          cardNumber: newCardNumber,
          expMonth,
          expYear,
          cvc: newCardCvc,
          cardholderName: newCardName.trim() || 'Alex Morgan',
          isDefault: true,
        });
        paymentMethodId = newMethod.id;
      }

      const cycle: SubscriptionBillingCycle =
        selectedPlan === 'lifetime' ? 'lifetime' : billingCycle;

      const chargeAmount =
        selectedPlan === 'lifetime'
          ? prices.lifetime
          : billingCycle === 'yearly'
          ? prices.annualTotal
          : prices.monthly;

      await stripeService.subscribeToPlan(
        selectedPlan,
        cycle,
        chargeAmount,
        currency,
        paymentMethodId
      );

      playChime('success');
      toast.success(
        `Welcome to FluencyAI ${selectedPlan === 'pro' ? 'Pro' : 'Lifetime'}! Your subscription is active.`,
        'Payment Succeeded'
      );

      setShowCheckout(false);
      onSuccess?.(selectedPlan);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Payment processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const detectedBrand = detectCardBrand(newCardNumber);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-b from-[#2a323d] to-[#151a22] p-1 border border-slate-700/60 shadow-md flex items-center justify-center overflow-hidden flex-shrink-0">
              <img src={logoMark} alt="Fluency AI" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                Fluency AI Membership Plans
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Accelerate your English speaking with real-time AI speech feedback
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Currency Switcher */}
            <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300">
              {(['GBP', 'USD', 'EUR'] as Currency[]).map((curr) => (
                <button
                  key={curr}
                  onClick={() => {
                    playChime('tap');
                    setCurrency(curr);
                  }}
                  className={`px-2 py-1 rounded-lg transition ${
                    currency === curr
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {CURRENCY_SYMBOLS[curr]} {curr}
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* Hero Banner */}
          <div className="text-center max-w-xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Investment in Your Global Voice</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Speak Fluent English with Total Composure
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              Choose the plan that matches your career ambitions. Risk-free with instant Stripe setup.
            </p>

            {/* Monthly vs Yearly Toggle */}
            <div className="pt-2 flex items-center justify-center gap-3">
              <span
                className={`text-xs font-extrabold cursor-pointer transition ${
                  billingCycle === 'monthly'
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                onClick={() => setBillingCycle('monthly')}
              >
                Monthly
              </span>
              <button
                type="button"
                onClick={() => {
                  playChime('tap');
                  setBillingCycle((c) => (c === 'monthly' ? 'yearly' : 'monthly'));
                }}
                className={`relative w-12 h-6.5 rounded-full transition-colors duration-200 p-0.5 ${
                  billingCycle === 'yearly' ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <div
                  className={`w-5.5 h-5.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                    billingCycle === 'yearly' ? 'translate-x-5.5' : 'translate-x-0'
                  }`}
                />
              </button>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-xs font-extrabold cursor-pointer transition ${
                    billingCycle === 'yearly'
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                  onClick={() => setBillingCycle('yearly')}
                >
                  Yearly Billing
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/20">
                  Save 35%
                </span>
              </div>
            </div>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Free Starter */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-850 flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-700 dark:text-slate-300 text-sm">
                    Free Starter
                  </span>
                  <span className="text-xl">🌱</span>
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900 dark:text-white">{symbol}0</span>
                    <span className="text-xs text-slate-500">/ forever</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Fundamental daily practice to start building confidence.
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>1 Daily Roleplay & Review</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>James (London RP Coach)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Basic SRS Flashcards (up to 30)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>CEFR Placement Check</span>
                  </div>
                </div>
              </div>

              <button
                disabled
                className="w-full py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold text-center cursor-default"
              >
                Current Default Plan
              </button>
            </div>

            {/* Card 2: Fluency Pro (Highlighted) */}
            <div className="relative rounded-3xl border-2 border-brand-500 dark:border-brand-400 p-5 bg-gradient-to-b from-brand-50/50 via-white to-white dark:from-brand-950/40 dark:via-slate-850 dark:to-slate-850 shadow-soft-lg flex flex-col justify-between space-y-5">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-brand-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-200" />
                <span>Most Popular</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-brand-700 dark:text-brand-300 text-sm">
                    Fluency Pro
                  </span>
                  <span className="text-xl">⚡</span>
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900 dark:text-white">
                      {symbol}
                      {billingCycle === 'yearly' ? prices.annualMonthly : prices.monthly}
                    </span>
                    <span className="text-xs text-slate-500">/ month</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {billingCycle === 'yearly'
                      ? `Billed annually at ${symbol}${prices.annualTotal}/yr (save 35%)`
                      : 'Billed monthly, cancel anytime'}
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-brand-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-600 dark:text-brand-400 flex-shrink-0" />
                    <span className="font-bold">Unlimited AI Roleplays & Lessons</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-600 dark:text-brand-400 flex-shrink-0" />
                    <span>All 4 British & Irish Voice Coaches</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-600 dark:text-brand-400 flex-shrink-0" />
                    <span>Live AI Phrasing Upgrades & Grammar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-600 dark:text-brand-400 flex-shrink-0" />
                    <span>Custom Scenario Builder with AI</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-600 dark:text-brand-400 flex-shrink-0" />
                    <span>Unlimited SRS Flashcards & Audio Review</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-600 dark:text-brand-400 flex-shrink-0" />
                    <span>60-Second Rapid Warmup & Cloud Sync</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleSelectPlan('pro')}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-black text-xs shadow-soft transition active:scale-98 flex items-center justify-center gap-1.5"
              >
                <span>Upgrade to Pro</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 3: Lifetime Mastery */}
            <div className="rounded-3xl border border-amber-300/60 dark:border-amber-500/30 p-5 bg-gradient-to-b from-amber-50/30 via-white to-white dark:from-amber-950/20 dark:via-slate-850 dark:to-slate-850 flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-amber-700 dark:text-amber-300 text-sm">
                    Lifetime Mastery
                  </span>
                  <span className="text-xl">👑</span>
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900 dark:text-white">
                      {symbol}
                      {prices.lifetime}
                    </span>
                    <span className="text-xs text-slate-500">/ one-time</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Pay once, speak with confidence forever. Never pay another subscription.
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span className="font-bold">All Pro Features Included Forever</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span>VIP Priority AI Processing Speed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span>Exclusive Diamond Avatar & Lifetime Badge</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span>Access to All Future Coaches & Updates</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleSelectPlan('lifetime')}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-amber-950 font-black text-xs shadow-soft transition active:scale-98 flex items-center justify-center gap-1.5"
              >
                <span>Get Lifetime Access</span>
                <Crown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Social Proof Quotes */}
          <div className="rounded-3xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Learner Stories & Reviews
              </span>
              <div className="flex items-center gap-1 text-amber-500 text-xs">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                ))}
                <span className="ml-1 font-bold text-slate-700 dark:text-slate-300">4.9 / 5.0</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-750 space-y-2">
                <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                  "James helped me prepare for my London tech interviews. His feedback on polite diplomatic phrasing made all the difference."
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center">
                    EK
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-slate-900 dark:text-white">Elena K.</div>
                    <div className="text-[10px] text-slate-400">Software Engineer, London</div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-750 space-y-2">
                <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                  "The 3-stage roleplay format gives you time to study natural idioms before jumping into the live voice chat. It feels like magic."
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center justify-center">
                    KT
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-slate-900 dark:text-white">Kenji T.</div>
                    <div className="text-[10px] text-slate-400">Product Manager, Tokyo</div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-750 space-y-2">
                <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                  "I was always nervous speaking in meetings. Having Emma gently coach my cadence gave me the confidence to present to international clients."
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-bold text-[10px] flex items-center justify-center">
                    MS
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-slate-900 dark:text-white">Maria S.</div>
                    <div className="text-[10px] text-slate-400">Healthcare Consultant, São Paulo</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FAQs Accordion */}
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-brand-600" />
              Frequently Asked Questions
            </h3>
            <div className="space-y-2">
              {FAQS.map((faq, idx) => {
                const isExpanded = expandedFaq === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-850 transition"
                  >
                    <button
                      onClick={() => {
                        playChime('tap');
                        setExpandedFaq(isExpanded ? null : idx);
                      }}
                      className="w-full p-3.5 text-left flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      <span>{faq.q}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stripe Security Seal */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <span>
                Secured by <span className="font-bold text-slate-900 dark:text-white">Stripe</span> •
                256-Bit SSL Encryption • PCI-DSS Level 1 Certified
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono font-bold">
              <span>VISA</span>
              <span>•</span>
              <span>MASTERCARD</span>
              <span>•</span>
              <span>AMEX</span>
              <span>•</span>
              <span>APPLE PAY</span>
            </div>
          </div>
        </div>

        {/* Interactive Stripe Checkout Modal Layer */}
        {showCheckout && (
          <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-scale-up">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs">
                    S
                  </div>
                  <div>
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      Stripe Checkout
                    </span>
                    <p className="text-[10px] text-slate-500">
                      FluencyAI {selectedPlan === 'pro' ? 'Pro' : 'Lifetime'} Membership
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCheckout(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Total Summary */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                    Total Due Now
                  </div>
                  <div className="text-[11px] text-indigo-600 dark:text-indigo-400">
                    {selectedPlan === 'lifetime'
                      ? 'One-time payment'
                      : billingCycle === 'yearly'
                      ? 'Annual renewal'
                      : 'Monthly subscription'}
                  </div>
                </div>
                <div className="text-xl font-black text-indigo-900 dark:text-indigo-100">
                  {symbol}
                  {selectedPlan === 'lifetime'
                    ? prices.lifetime
                    : billingCycle === 'yearly'
                    ? prices.annualTotal
                    : prices.monthly}
                </div>
              </div>

              {/* Payment Method Selector */}
              <form onSubmit={handleProcessCheckout} className="space-y-4">
                {savedCards.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Select Payment Method
                    </label>
                    <div className="space-y-1.5">
                      {savedCards.map((card) => (
                        <label
                          key={card.id}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                            selectedCardId === card.id
                              ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                              : 'border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="radio"
                              name="checkoutCard"
                              value={card.id}
                              checked={selectedCardId === card.id}
                              onChange={() => setSelectedCardId(card.id)}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <CreditCard className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase">
                              {card.brand} •••• {card.last4}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            Exp {String(card.expMonth).padStart(2, '0')}/{String(card.expYear).slice(-2)}
                          </span>
                        </label>
                      ))}

                      <label
                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                          selectedCardId === 'new'
                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <input
                          type="radio"
                          name="checkoutCard"
                          value="new"
                          checked={selectedCardId === 'new'}
                          onChange={() => setSelectedCardId('new')}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Use a new credit or debit card
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* New Card Fields */}
                {selectedCardId === 'new' && (
                  <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Cardholder Name
                      </label>
                      <input
                        type="text"
                        value={newCardName}
                        onChange={(e) => setNewCardName(e.target.value)}
                        placeholder="Alex Morgan"
                        className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                        <span>Card Number</span>
                        {detectedBrand !== 'unknown' && (
                          <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">
                            {detectedBrand}
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        maxLength={19}
                        value={newCardNumber}
                        onChange={(e) => setNewCardNumber(formatCardNumberInput(e.target.value))}
                        placeholder="4242 4242 4242 4242"
                        className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 outline-hidden"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          Expires (MM/YY)
                        </label>
                        <input
                          type="text"
                          maxLength={5}
                          value={newCardExp}
                          onChange={(e) => setNewCardExp(formatExpiryInput(e.target.value))}
                          placeholder="12/28"
                          className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          CVC
                        </label>
                        <input
                          type="text"
                          maxLength={4}
                          value={newCardCvc}
                          onChange={(e) => setNewCardCvc(e.target.value.replace(/\D/g, ''))}
                          placeholder="CVC"
                          className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs shadow-soft transition active:scale-98 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Authorizing with Stripe...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>
                        Authorize &amp; Pay {symbol}
                        {selectedPlan === 'lifetime'
                          ? prices.lifetime
                          : billingCycle === 'yearly'
                          ? prices.annualTotal
                          : prices.monthly}
                      </span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
