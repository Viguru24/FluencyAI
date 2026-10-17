/**
 * Stripe Payment & Subscription Service
 * 
 * Manages:
 * - Stripe Payment Methods (Cards: Visa, Mastercard, Amex, Discover, etc.)
 * - Subscriptions (Free, Pro Monthly/Yearly, Lifetime Mastery)
 * - Invoices & Payment Receipts
 * - Client-side validation (Luhn algorithm, brand detection, expiry)
 * - Real-time custom event broadcasts for UI reactivity
 */

import type {
  CardBrand,
  StripePaymentMethod,
  StripeInvoice,
  SubscriptionDetails,
  SubscriptionPlanTier,
  SubscriptionBillingCycle,
} from '../types';

const STORAGE_PAYMENT_METHODS_KEY = 'fluency_stripe_payment_methods_v1';
const STORAGE_SUBSCRIPTION_KEY = 'fluency_stripe_subscription_v1';
const STORAGE_INVOICES_KEY = 'fluency_stripe_invoices_v1';
const STORAGE_STRIPE_PK_KEY = 'fluency_stripe_publishable_key';

const DEFAULT_STRIPE_PK =
  (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY ||
  'pk_test_51N_fluencyai_demo_stripe_checkout';

// Initial realistic mock card so user can immediately experience the UX
const INITIAL_PAYMENT_METHODS: StripePaymentMethod[] = [
  {
    id: 'pm_card_visa_demo4242',
    brand: 'visa',
    last4: '4242',
    expMonth: 8,
    expYear: 2029,
    isDefault: true,
    cardholderName: 'Alex Morgan',
    country: 'GB',
    funding: 'credit',
    createdAt: new Date().toISOString(),
  },
];

const INITIAL_SUBSCRIPTION: SubscriptionDetails = {
  planTier: 'free',
  billingCycle: 'monthly',
  status: 'free',
  renewsAt: undefined,
  cancelAtPeriodEnd: false,
};

// --- Brand Detection & Card Helpers ---

export function detectCardBrand(rawNumber: string): CardBrand {
  const clean = rawNumber.replace(/\D/g, '');
  if (/^4/.test(clean)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(clean)) return 'mastercard';
  if (/^3[47]/.test(clean)) return 'amex';
  if (/^(6011|65|64[4-9])/.test(clean)) return 'discover';
  if (/^3(?:0[0-5]|[68])/.test(clean)) return 'diners';
  if (/^(?:2131|1800|35)/.test(clean)) return 'jcb';
  return 'unknown';
}

export function validateCardLuhn(numberStr: string): boolean {
  const digits = numberStr.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits.charAt(i), 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export function formatCardNumberInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  const parts = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.substring(i, i + 4));
  }
  return parts.join(' ');
}

export function formatExpiryInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return digits;
}

// --- Stripe Service Class ---

class StripeService {
  private publishableKey: string = DEFAULT_STRIPE_PK;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem(STORAGE_STRIPE_PK_KEY);
      if (savedKey) this.publishableKey = savedKey;
    }
  }

  public getPublishableKey(): string {
    return this.publishableKey;
  }

  public setPublishableKey(key: string): void {
    this.publishableKey = key.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_STRIPE_PK_KEY, this.publishableKey);
    }
  }

  public getSubscription(): SubscriptionDetails {
    if (typeof window === 'undefined') return INITIAL_SUBSCRIPTION;
    try {
      const saved = localStorage.getItem(STORAGE_SUBSCRIPTION_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('[stripeService] Failed to load subscription', e);
    }
    return INITIAL_SUBSCRIPTION;
  }

  public setSubscription(sub: SubscriptionDetails): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_SUBSCRIPTION_KEY, JSON.stringify(sub));
      window.dispatchEvent(
        new CustomEvent('fluency_subscription_updated', { detail: sub })
      );
    } catch (e) {
      console.warn('[stripeService] Failed to save subscription', e);
    }
  }

  public getPaymentMethods(): StripePaymentMethod[] {
    if (typeof window === 'undefined') return INITIAL_PAYMENT_METHODS;
    try {
      const saved = localStorage.getItem(STORAGE_PAYMENT_METHODS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('[stripeService] Failed to load payment methods', e);
    }
    // Return default initial mock card if none exist yet
    this.savePaymentMethods(INITIAL_PAYMENT_METHODS);
    return INITIAL_PAYMENT_METHODS;
  }

  private savePaymentMethods(methods: StripePaymentMethod[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_PAYMENT_METHODS_KEY, JSON.stringify(methods));
      window.dispatchEvent(
        new CustomEvent('fluency_payment_methods_changed', { detail: methods })
      );
    } catch (e) {
      console.warn('[stripeService] Failed to save payment methods', e);
    }
  }

  public async addPaymentMethod(params: {
    cardNumber: string;
    expMonth: number;
    expYear: number;
    cvc: string;
    cardholderName: string;
    isDefault?: boolean;
    country?: string;
  }): Promise<StripePaymentMethod> {
    // Artificial latency to mirror Stripe Elements confirmation
    await new Promise((resolve) => setTimeout(resolve, 450));

    const cleanNumber = params.cardNumber.replace(/\D/g, '');
    if (cleanNumber.length < 13) {
      throw new Error('Please enter a valid card number.');
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    if (
      params.expYear < currentYear ||
      (params.expYear === currentYear && params.expMonth < currentMonth)
    ) {
      throw new Error('The card expiration date is in the past.');
    }

    if (params.cvc.replace(/\D/g, '').length < 3) {
      throw new Error('Please enter a valid CVC code.');
    }

    if (!params.cardholderName.trim()) {
      throw new Error('Please enter the name on the card.');
    }

    const brand = detectCardBrand(cleanNumber);
    const last4 = cleanNumber.slice(-4);
    const existing = this.getPaymentMethods();

    const shouldBeDefault = params.isDefault || existing.length === 0;

    const newMethod: StripePaymentMethod = {
      id: `pm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      brand,
      last4,
      expMonth: params.expMonth,
      expYear: params.expYear,
      isDefault: shouldBeDefault,
      cardholderName: params.cardholderName.trim(),
      country: params.country || 'GB',
      funding: 'credit',
      createdAt: new Date().toISOString(),
    };

    let updated = existing;
    if (shouldBeDefault) {
      updated = updated.map((m) => ({ ...m, isDefault: false }));
    }
    updated = [newMethod, ...updated];

    this.savePaymentMethods(updated);
    return newMethod;
  }

  public setDefaultPaymentMethod(id: string): void {
    const existing = this.getPaymentMethods();
    const updated = existing.map((m) => ({
      ...m,
      isDefault: m.id === id,
    }));
    this.savePaymentMethods(updated);
  }

  public removePaymentMethod(id: string): void {
    const existing = this.getPaymentMethods();
    const filtered = existing.filter((m) => m.id !== id);

    // If we removed the default card, assign default to the first remaining card
    if (filtered.length > 0 && !filtered.some((m) => m.isDefault)) {
      filtered[0].isDefault = true;
    }

    this.savePaymentMethods(filtered);
  }

  public getInvoices(): StripeInvoice[] {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(STORAGE_INVOICES_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('[stripeService] Failed to load invoices', e);
    }
    return [];
  }

  private saveInvoice(inv: StripeInvoice): void {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getInvoices();
      const updated = [inv, ...current];
      localStorage.setItem(STORAGE_INVOICES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[stripeService] Failed to save invoice', e);
    }
  }

  public async subscribeToPlan(
    planTier: SubscriptionPlanTier,
    billingCycle: SubscriptionBillingCycle,
    amount: number,
    currency: string = 'GBP',
    paymentMethodId?: string
  ): Promise<SubscriptionDetails> {
    // Artificial latency for Stripe webhook simulation
    await new Promise((resolve) => setTimeout(resolve, 600));

    const existingMethods = this.getPaymentMethods();
    const activePM = paymentMethodId
      ? existingMethods.find((m) => m.id === paymentMethodId)
      : existingMethods.find((m) => m.isDefault) || existingMethods[0];

    const now = new Date();
    let renewsAt: string | undefined = undefined;

    if (planTier === 'pro') {
      const renewDate = new Date();
      if (billingCycle === 'monthly') {
        renewDate.setMonth(renewDate.getMonth() + 1);
      } else {
        renewDate.setFullYear(renewDate.getFullYear() + 1);
      }
      renewsAt = renewDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }

    const updatedSub: SubscriptionDetails = {
      planTier,
      billingCycle,
      status: planTier === 'free' ? 'free' : 'active',
      renewsAt,
      cancelAtPeriodEnd: false,
      currentPeriodStart: now.toISOString(),
      defaultPaymentMethodId: activePM?.id,
      stripeSubscriptionId:
        planTier === 'free'
          ? undefined
          : `sub_${Math.random().toString(36).substring(2, 11)}`,
      stripeCustomerId: `cus_${Math.random().toString(36).substring(2, 11)}`,
    };

    this.setSubscription(updatedSub);

    // If paid tier, generate invoice receipt
    if (planTier !== 'free' && amount > 0) {
      const invoiceNumber = `INV-${now.getFullYear()}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;
      const newInvoice: StripeInvoice = {
        id: `in_${Date.now()}`,
        number: invoiceNumber,
        date: now.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        amountPaid: amount,
        currency,
        status: 'paid',
        planTier,
        description:
          planTier === 'lifetime'
            ? 'FluencyAI Lifetime Mastery Pass (One-Time Payment)'
            : `FluencyAI Pro Plan (${billingCycle === 'yearly' ? 'Annual' : 'Monthly'})`,
        hostedInvoiceUrl: `https://billing.stripe.com/p/session/test_${Date.now()}`,
      };
      this.saveInvoice(newInvoice);
    }

    return updatedSub;
  }

  public cancelSubscription(): SubscriptionDetails {
    const current = this.getSubscription();
    const updated: SubscriptionDetails = {
      ...current,
      cancelAtPeriodEnd: true,
    };
    this.setSubscription(updated);
    return updated;
  }

  public reactivateSubscription(): SubscriptionDetails {
    const current = this.getSubscription();
    const updated: SubscriptionDetails = {
      ...current,
      cancelAtPeriodEnd: false,
    };
    this.setSubscription(updated);
    return updated;
  }
}

export const stripeService = new StripeService();
