export const SPEECH_SETTINGS_KEY = "keeperSpeechSettings";

// ─── Phase 1 improvement ────────────────────────────────────────────────────
// rate  : 0.9  (was 1.0) — sounds calmer and more natural on all engines
// pitch : 1.05 (was 1.0) — adds a small amount of intonation variance;
//                          prevents the completely flat "robot" quality
// voiceURI: ""            — empty means "let pickBestVoice() choose"
// ────────────────────────────────────────────────────────────────────────────
export const DEFAULT_SPEECH_SETTINGS = {
  rate: 0.9,
  pitch: 1.05,
  voiceURI: "",
};

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function normalizeSpeechSettings(settings) {
  return {
    rate: clampNumber(settings?.rate, 0.5, 2, DEFAULT_SPEECH_SETTINGS.rate),
    pitch: clampNumber(settings?.pitch, 0.5, 2, DEFAULT_SPEECH_SETTINGS.pitch),
    voiceURI:
      typeof settings?.voiceURI === "string"
        ? settings.voiceURI
        : DEFAULT_SPEECH_SETTINGS.voiceURI,
  };
}

export function loadSpeechSettings() {
  if (typeof window === "undefined") return DEFAULT_SPEECH_SETTINGS;

  try {
    const saved = window.localStorage.getItem(SPEECH_SETTINGS_KEY);
    if (!saved) return DEFAULT_SPEECH_SETTINGS;
    return normalizeSpeechSettings(JSON.parse(saved));
  } catch (err) {
    console.error("Could not load speech settings:", err);
    return DEFAULT_SPEECH_SETTINGS;
  }
}

export function saveSpeechSettings(settings) {
  const normalized = normalizeSpeechSettings(settings);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(SPEECH_SETTINGS_KEY, JSON.stringify(normalized));
  }

  return normalized;
}