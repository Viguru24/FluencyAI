# FluencyAI — AI-Powered English Language Tutoring PWA

A mobile-first, Progressive Web App (PWA) designed for English language learners, featuring interactive voice immersion, conversational roleplays, dynamic daily goal tracking, and accessible pronunciation coaching.

## ✨ Highlights & Features

- **Mobile-First Welcoming Interface:**
  - Contextual time-of-day greeting with streak counter and daily motivation.
  - Interactive Daily Speaking Goal progress bar with dual tracking (Minutes spoken + XP).
  - Milestone logging & celebratory animations powered by Web Audio chimes and Canvas Confetti.

- **Upcoming Roleplay Scenarios:**
  - Realistic conversational simulations tailored by CEFR difficulty (A1–C1):
    - *Ordering Specialty Coffee in London* (A2 • British English & café etiquette)
    - *Job Interview: Pitching Your Strengths* (B2 • STAR method & professional diction)
    - *Boutique Hotel: Check-In & Room Upgrade* (B1 • Courteous requests)
    - *Casual Networking at a Tech Meetup* (B1–B2 • Small talk & icebreakers)
    - *Express Care: Explaining Symptoms at a Clinic* (A2 • Everyday health clarity)
  - Interactive dialogue flow with speech synthesis playback, real-time voice recognition microphone input, and instant AI grammar & natural phrasing feedback.

- **'Start Daily Lesson' Floating Action Button (FAB):**
  - Prominent mobile FAB with pulsing glow and reward preview (`5 min • +35 XP`).
  - 3-step structured micro-learning module:
    1. *Phrase of the Day* with phonetic IPA, native translation, and cultural notes.
    2. *Context & Comprehension Quiz* with instant coaching explanation.
    3. *Speaking Challenge* with voice pronunciation test and accuracy scoring.

- **Non-Native Speaker Accessibility:**
  - Soft, encouraging color tones (calming blues, soothing mints, warm amber accents).
  - Instant native translation support for 8 languages (Spanish, Mandarin, Japanese, Portuguese, Arabic, French, Vietnamese, German).
  - Multi-speed audio playback toggle (0.75x slow & articulate vs 1.0x natural speed).
  - Visual IPA guides and tap-to-pronounce on all key vocabulary.

- **Complete Progressive Web App (PWA) Capabilities:**
  - `manifest.webmanifest` configured for fullscreen standalone display.
  - Custom branded high-resolution icons (192px, 512px, maskable adaptive icons, Apple Touch Icon, SVG).
  - Service worker (`sw.js`) with cache-first and stale-while-revalidate strategies for full offline access.
  - In-app install button and iOS Safari / Android Chrome install guide modal.
  - Offline mode detection and automatic update notifications.

---

## 🛠️ Technology Stack

- **Framework:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS + Plus Jakarta Sans Typography
- **Icons:** Lucide React
- **Voice Immersion:** Web Speech API (Synthesis & Recognition) + Web Audio API Synthesis
- **Gamification:** Canvas Confetti + LocalStorage State Persistence
- **PWA:** Service Worker Cache API + Web App Manifest

---

## 🚀 Running Locally

```powershell
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```
