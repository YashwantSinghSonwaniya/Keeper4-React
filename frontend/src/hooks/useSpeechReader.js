import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  DEFAULT_SPEECH_SETTINGS,
  loadSpeechSettings,
} from "../speechSettings";

// ─── Debug flag ──────────────────────────────────────────────────────────────
// Set to true during development to see voice diagnostics in the console.
// Remove or set to false before production build.
const DEBUG_SPEECH = process.env.NODE_ENV === "development";
// ─────────────────────────────────────────────────────────────────────────────

function isSpeechSupported() {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

function buildSpeechText(title, content) {
  return [title, content]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(". ");
}

function getBrowserVoices() {
  if (!isSpeechSupported()) return [];
  return window.speechSynthesis.getVoices() || [];
}

function getSpeechErrorMessage(event) {
  if (event?.error === "interrupted" || event?.error === "canceled") {
    return "Speech reading was interrupted.";
  }
  if (event?.error === "not-allowed") {
    return "Speech reading was blocked by the browser. Try tapping Read again.";
  }
  return "Speech reading stopped unexpectedly.";
}

// ─── Phase 1: Smart voice picker ─────────────────────────────────────────────
//
// Priority order (highest quality to lowest):
//   1. Google voices with en-US  — best quality on Chrome/Android
//   2. Microsoft Neural voices   — best quality on Edge/Windows
//   3. Well-known natural voices — Samantha (macOS), Karen (iOS),
//                                  Daniel (UK), Moira (Irish)
//   4. Any en-US voice           — any local US English
//   5. Any English voice         — fallback to any English
//   6. null                      — let the browser decide (current behaviour)
//
// Only used when voiceURI is "" (the default / "Browser default" option).
// Any explicit user selection in Settings bypasses this entirely.
//
function pickBestVoice(voices, preferredURI) {
  // 1. User has explicitly chosen a voice in Settings — always honour it
  if (preferredURI) {
    const exact = voices.find((v) => v.voiceURI === preferredURI);
    if (exact) return exact;
    // voiceURI saved but no longer available (e.g. different browser/OS)
    // fall through to auto-pick rather than silently using browser default
  }

  // 2. Auto-pick the highest-quality English voice available
  const tests = [
    (v) => /google/i.test(v.name) && /en[-_]US/i.test(v.lang),
    (v) => /microsoft/i.test(v.name) && /neural/i.test(v.name) && /en/i.test(v.lang),
    (v) => /samantha|karen|daniel|moira|aria|guy/i.test(v.name),
    (v) => /en[-_]US/i.test(v.lang),
    (v) => /en/i.test(v.lang),
  ];

  for (const test of tests) {
    const found = voices.find(test);
    if (found) return found;
  }

  return null; // let the browser decide — same as before Phase 1
}
// ─────────────────────────────────────────────────────────────────────────────

function useSpeechReader() {
  const supported = isSpeechSupported();
  const [voices, setVoices] = useState([]);
  const [settings, setSettings] = useState(() =>
    supported ? loadSpeechSettings() : DEFAULT_SPEECH_SETTINGS,
  );
  const [activeId, setActiveId] = useState(null);
  const [status, setStatus] = useState("idle");

  const utteranceRef = useRef(null);
  const activeIdRef = useRef(null);
  const manuallyStoppedRef = useRef(false);
  const noVoicesNoticeShownRef = useRef(false);

  const reloadVoices = useCallback(() => {
    if (!isSpeechSupported()) return [];
    const loadedVoices = getBrowserVoices();
    setVoices(loadedVoices);
    return loadedVoices;
  }, []);

  useEffect(() => {
    if (!supported) return undefined;

    reloadVoices();
    if (typeof window.speechSynthesis.addEventListener === "function") {
      window.speechSynthesis.addEventListener("voiceschanged", reloadVoices);
    } else {
      window.speechSynthesis.onvoiceschanged = reloadVoices;
    }

    return () => {
      if (typeof window.speechSynthesis.removeEventListener === "function") {
        window.speechSynthesis.removeEventListener("voiceschanged", reloadVoices);
      } else if (window.speechSynthesis.onvoiceschanged === reloadVoices) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [reloadVoices, supported]);

  useEffect(() => {
    if (!supported) return undefined;

    function syncSettingsFromStorage(event) {
      if (!event || event.key === "keeperSpeechSettings") {
        setSettings(loadSpeechSettings());
      }
    }

    window.addEventListener("storage", syncSettingsFromStorage);
    window.addEventListener("focus", syncSettingsFromStorage);

    return () => {
      window.removeEventListener("storage", syncSettingsFromStorage);
      window.removeEventListener("focus", syncSettingsFromStorage);
    };
  }, [supported]);

  const resetState = useCallback(() => {
    utteranceRef.current = null;
    activeIdRef.current = null;
    setActiveId(null);
    setStatus("idle");
  }, []);

  const stop = useCallback(() => {
    if (!isSpeechSupported()) {
      resetState();
      return;
    }

    manuallyStoppedRef.current = true;
    window.speechSynthesis.cancel();
    resetState();
  }, [resetState]);

  useEffect(() => {
    return () => {
      if (isSpeechSupported()) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const readNote = useCallback(
    (noteId, note) => {
      if (!isSpeechSupported()) {
        toast.error("Speech reading is not supported in this browser.");
        return false;
      }

      const text = buildSpeechText(note?.title, note?.content);
      if (!text) {
        toast.error("No content available to read.");
        return false;
      }

      manuallyStoppedRef.current = true;
      window.speechSynthesis.cancel();
      manuallyStoppedRef.current = false;

      const latestSettings = loadSpeechSettings();
      setSettings(latestSettings);

      const utterance = new window.SpeechSynthesisUtterance(text);
      const latestVoices = reloadVoices();

      // ── Phase 1: use smart picker instead of exact-match-only ──────────────
      const selectedVoice = pickBestVoice(latestVoices, latestSettings.voiceURI);
      // ───────────────────────────────────────────────────────────────────────

      if (latestVoices.length === 0 && !noVoicesNoticeShownRef.current) {
        toast("No browser voices found. Using the default voice.");
        noVoicesNoticeShownRef.current = true;
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = latestSettings.rate;
      utterance.pitch = latestSettings.pitch;

      // ── Phase 1: debug diagnostics (dev only) ──────────────────────────────
      if (DEBUG_SPEECH) {
        console.group("[SpeechReader] Starting utterance");
        console.log("Voice selected :", selectedVoice ? selectedVoice.name : "browser default");
        console.log("Voice lang     :", selectedVoice ? selectedVoice.lang : "unknown");
        console.log("Voice URI      :", selectedVoice ? selectedVoice.voiceURI : "—");
        console.log("Rate           :", utterance.rate);
        console.log("Pitch          :", utterance.pitch);
        console.log("Text length    :", text.length, "characters");
        console.log("Voices available:", latestVoices.length);
        console.log("User pref URI  :", latestSettings.voiceURI || "(none — auto)");
        console.groupEnd();
      }
      // ───────────────────────────────────────────────────────────────────────

      utteranceRef.current = utterance;
      activeIdRef.current = noteId;
      setActiveId(noteId);
      setStatus("reading");

      utterance.onstart = () => {
        if (utteranceRef.current !== utterance) return;
        setActiveId(noteId);
        setStatus("reading");
      };

      utterance.onend = () => {
        if (utteranceRef.current !== utterance) return;
        resetState();
      };

      utterance.onerror = (event) => {
        if (utteranceRef.current !== utterance) return;
        const wasManualStop = manuallyStoppedRef.current;
        resetState();
        if (!wasManualStop) {
          toast.error(getSpeechErrorMessage(event));
        }
      };

      try {
        window.speechSynthesis.speak(utterance);
        return true;
      } catch (err) {
        console.error("Speech reading failed:", err);
        resetState();
        toast.error("Speech reading stopped unexpectedly.");
        return false;
      }
    },
    [reloadVoices, resetState],
  );

  const pause = useCallback(() => {
    if (!isSpeechSupported() || !activeIdRef.current) return;
    window.speechSynthesis.pause();
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    if (!isSpeechSupported() || !activeIdRef.current) return;
    window.speechSynthesis.resume();
    setStatus("reading");
  }, []);

  const toggleNote = useCallback(
    (noteId, note) => {
      if (activeId === noteId && status === "reading") {
        pause();
        return;
      }

      if (activeId === noteId && status === "paused") {
        resume();
        return;
      }

      readNote(noteId, note);
    },
    [activeId, pause, readNote, resume, status],
  );

  const getNoteSpeechState = useCallback(
    (noteId) => {
      const isActive = activeId === noteId;
      const isReading = isActive && status === "reading";
      const isPaused = isActive && status === "paused";

      return {
        isActive,
        isReading,
        isPaused,
        label: isReading ? "Pause" : isPaused ? "Resume" : "Read",
        icon: isReading ? "⏸" : isPaused ? "▶" : "🔊",
      };
    },
    [activeId, status],
  );

  return {
    supported,
    voices,
    settings,
    activeId,
    status,
    isReading: status === "reading",
    isPaused: status === "paused",
    readNote,
    toggleNote,
    pause,
    resume,
    stop,
    getNoteSpeechState,
    reloadVoices,
  };
}

export default useSpeechReader;