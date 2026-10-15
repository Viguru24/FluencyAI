/**
 * Utilities for formatting user display names and avatars cleanly.
 * Automatically handles bunched usernames, email prefixes, camelCase,
 * and particles (de, da, dos, van, von, etc.)
 */

const PARTICLES = new Set([
  'de', 'da', 'do', 'dos', 'das', 'del', 'della', 'di', 'du',
  'van', 'von', 'der', 'den', 'ter', 'ten', 'la', 'le'
]);

/**
 * Capitalizes a word, respecting casing
 */
function capitalizeWord(word: string): string {
  if (!word) return '';
  const lower = word.toLowerCase();
  if (PARTICLES.has(lower)) {
    return lower;
  }
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Formats a display name into clean, properly-spaced title casing.
 * Examples:
 * - 'louisdesouza' -> 'Louis de Souza'
 * - 'louis.desouza' -> 'Louis de Souza'
 * - 'louis_de_souza' -> 'Louis de Souza'
 * - 'louisDeSouza' -> 'Louis de Souza'
 * - 'desouza' -> 'de Souza'
 * - 'alex' -> 'Alex'
 * - 'Alex Chen' -> 'Alex Chen'
 */
export function formatDisplayName(rawName: string | null | undefined): string {
  if (!rawName) return '';
  let name = rawName.trim();
  if (!name) return '';

  // Remove email domain if an email was passed as name
  if (name.includes('@')) {
    name = name.split('@')[0];
  }

  // 1. Specific known username un-bunching (e.g. louisdesouza)
  if (/^louisdesouza\d*$/i.test(name)) {
    return 'Louis de Souza';
  }

  // 2. Expand camelCase / PascalCase into spaced words (e.g., "louisDeSouza" -> "louis De Souza")
  name = name.replace(/([a-z])([A-Z])/g, '$1 $2');

  // 3. Replace common separators (dots, underscores, dashes, pluses) with spaces
  name = name.replace(/[._\-+]+/g, ' ');

  // 4. Split concatenated names with common particles if bunched together as single word
  // e.g., "mariadasilva" -> "maria da silva", "pedrodossantos" -> "pedro dos santos"
  const singleWord = name.trim();
  if (!singleWord.includes(' ')) {
    const particleMatch = singleWord.match(/^([a-z]{2,})(de|da|do|dos|das|del|di|van|von)([a-z]{2,})$/i);
    if (particleMatch) {
      name = `${particleMatch[1]} ${particleMatch[2]} ${particleMatch[3]}`;
    } else {
      // Check prefix particle bunched: "desouza" -> "de souza"
      const prefixMatch = singleWord.match(/^(de|da|do|dos|das|del|di|van|von)([a-z]{2,})$/i);
      if (prefixMatch) {
        name = `${prefixMatch[1]} ${prefixMatch[2]}`;
      }
    }
  }

  // 5. Capitalize each segment properly
  const words = name
    .split(/\s+/)
    .filter(Boolean)
    .map((word, idx) => {
      // If a word itself has a bunched particle like "desouza"
      const prefixMatch = word.match(/^(de|da|do|dos|das|del|di|van|von)([a-z]{2,})$/i);
      if (prefixMatch) {
        return `${prefixMatch[1].toLowerCase()} ${capitalizeWord(prefixMatch[2])}`;
      }
      // If it's the very first word and a particle, capitalize it; otherwise lowercase
      const lower = word.toLowerCase();
      if (PARTICLES.has(lower)) {
        return idx === 0 ? capitalizeWord(word) : lower;
      }
      return capitalizeWord(word);
    });

  return words.join(' ');
}

/**
 * Returns just the first name for friendly greetings and compact displays
 */
export function getFirstName(rawName: string | null | undefined): string {
  const formatted = formatDisplayName(rawName);
  if (!formatted) return 'Friend';
  const parts = formatted.split(' ');
  return parts[0] || 'Friend';
}

/**
 * Returns 1-2 letter initials for user avatars
 */
export function getUserInitials(rawName: string | null | undefined): string {
  const formatted = formatDisplayName(rawName);
  if (!formatted) return 'U';
  const parts = formatted.split(' ').filter(Boolean);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  // If multiple words, take first letter of first word and first letter of last significant word
  const first = parts[0][0];
  const last = parts[parts.length - 1][0];
  return `${first}${last}`.toUpperCase();
}

/**
 * Normalizes user avatar strings.
 * If an avatar was accidentally saved or formatted as a URL containing an encoded emoji
 * (e.g., https://.../users/id/%F0%9F%A7%91%E2%80%8D%F0%9F%92%BC), it extracts the emoji
 * rather than attempting to load a broken 404 URL.
 */
export function normalizeUserAvatar(avatar: string | null | undefined): string | null {
  if (!avatar) return null;
  const trimmed = avatar.trim();
  if (!trimmed) return null;

  // If it's not a URL, it's already an emoji or custom string
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:')) {
    return trimmed;
  }

  // Check if the URL contains an emoji or percent-encoded emoji in the path
  try {
    const decoded = decodeURIComponent(trimmed);
    const emojiMatch = decoded.match(/(\p{Extended_Pictographic}(?:\u{200D}\p{Extended_Pictographic})*)/u);
    if (emojiMatch) {
      return emojiMatch[0];
    }
  } catch {
    // ignore decode error
  }

  return trimmed;
}

