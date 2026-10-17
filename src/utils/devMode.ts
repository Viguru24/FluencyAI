/**
 * Developer mode helper to gate technical LLM plumbing, port badges,
 * and simulation/testing buttons behind `?dev=true` or `localStorage.getItem('fluency_dev_mode') === 'true'`.
 */
export function isDevMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.location.search.includes('dev=true') ||
      localStorage.getItem('fluency_dev_mode') === 'true'
    );
  } catch {
    return false;
  }
}
