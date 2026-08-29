/**
 * Development-only logging.
 *
 * Only question metadata (id, type, category, field, confidence) is emitted.
 * Question labels are deliberately NOT logged: a form title or label can
 * embed personal data (an email, a roll number), and Phase 2 must never put
 * user data into logs. No values, profile data, or answers are ever logged.
 */
export type DebugLog = (message: string) => void;

export function makeLogger(enabled: boolean): DebugLog {
  if (!enabled) return () => undefined;
  return (message: string) => console.log(`[Phase2] ${message}`);
}