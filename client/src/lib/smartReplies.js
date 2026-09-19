// Tiny on-device smart replies: deterministic, no network, no AI keys.
// Suggests 1-tap answers based on the latest incoming message.
const MAX_SUGGESTIONS = 3;

const firstSentence = (text = "") => {
  const clean = String(text).trim().replace(/\s+/g, " ");
  if (!clean) return "";
  const m = clean.match(/^[^.?!]{1,80}[.?!]?/);
  return (m ? m[0] : clean.slice(0, 80)).trim();
};

const RULES = [
  {
    test: (t) => /\b(are you|will you|can you|would you|could you|do you|did you|have you|has |is it|are we|shall we|coming|joining|free|available)\b.*\?/i.test(t),
    replies: () => ["Yes 👍", "No 👎", "Let me check"],
  },
  {
    test: (t) => /\?/.test(t),
    replies: () => ["Sure!", "Not sure", "Give me a minute"],
  },
  {
    test: (t) => /\b(thank|thanks|thx|grateful)\b/i.test(t),
    replies: () => ["You're welcome!", "Anytime 🙌", "👍"],
  },
  {
    test: (t) => /\b(hi|hello|hey|good morning|good evening|good afternoon|yo)\b/i.test(t) && t.length < 40,
    replies: () => ["Hey! 👋", "Hi there!", "Hello!"],
  },
  {
    test: (t) => /\b(sorry|apolog)\b/i.test(t),
    replies: () => ["No worries!", "It's okay 👍"],
  },
  {
    test: (t) => /\b(congrats|congratulations|well done|awesome|amazing|great job)\b/i.test(t),
    replies: () => ["Thank you! 🎉", "🙌"],
  },
  {
    test: (t) => /\b(ok|okay|k|👍|done|sent|received)\b/i.test(t) && t.length < 25,
    replies: () => ["👍", "Perfect!", "Got it"],
  },
  {
    test: (t) => /\b(when|what time|tomorrow|today|tonight|weekend|meeting|call|deadline|party|plan)\b/i.test(t),
    replies: () => ["Sounds good!", "What time?", "Count me in 🙋"],
  },
];

export function getSmartReplies(lastIncomingText) {
  const text = firstSentence(lastIncomingText || "");
  if (!text || text.length < 2) return [];
  // Skip non-text content markers
  if (/^(📷|📎|🎤|👤|🔒)/u.test(text)) return [];
  for (const rule of RULES) {
    try {
      if (rule.test(text)) return rule.replies(text).slice(0, MAX_SUGGESTIONS);
    } catch {
      // fall through to next rule
    }
  }
  return [];
}
