import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  DEFAULT_SPEECH_SETTINGS,
  loadSpeechSettings,
} from "../speechSettings";

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
      const selectedVoice = latestVoices.find(
        (voice) => voice.voiceURI === latestSettings.voiceURI,
      );

      if (latestVoices.length === 0 && !noVoicesNoticeShownRef.current) {
        toast("No browser voices found. Using the default voice.");
        noVoicesNoticeShownRef.current = true;
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = latestSettings.rate;
      utterance.pitch = latestSettings.pitch;

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
