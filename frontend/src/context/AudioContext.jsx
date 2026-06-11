/**
 * AudioContext.jsx
 *
 * Global audio coordinator. Ensures only ONE audio source (TTS or voice note)
 * plays at a time across the entire application.
 *
 * Rules enforced here:
 *  - Starting TTS  → stops any active voice note, then registers TTS as active.
 *  - Starting voice note → cancels TTS, stops other voice notes, registers itself.
 *  - Only one voice note may play at a time.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

const AudioCoordinatorContext = createContext(null);

export function AudioProvider({ children }) {
  /**
   * activeSource: null | { type: "speech" | "voiceNote", id: string }
   * Used only for external consumers that want to know what's playing.
   * Internal coordination uses refs (stopCallbacksRef) to avoid stale closures.
   */
  const [activeSource, setActiveSource] = useState(null);

  /**
   * Registry: voiceNoteId → stopFn
   * Each mounted VoiceNotePlayer registers its stop callback here.
   */
  const stopCallbacksRef = useRef(new Map());

  // ─── VoiceNotePlayer API ──────────────────────────────────────────────────

  /**
   * Called by each VoiceNotePlayer on mount.
   * Returns an unregister function to call on unmount.
   */
  const registerVoiceNote = useCallback((id, stopFn) => {
    stopCallbacksRef.current.set(id, stopFn);
    return () => {
      stopCallbacksRef.current.delete(id);
    };
  }, []);

  /**
   * Called by a VoiceNotePlayer just before it starts playing.
   * Stops TTS and all other voice notes.
   */
  const requestVoiceNotePlay = useCallback((id) => {
    // 1. Stop TTS if active
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    // 2. Stop all other voice notes
    stopCallbacksRef.current.forEach((stopFn, registeredId) => {
      if (registeredId !== id) {
        stopFn();
      }
    });

    // 3. Register this as the active source
    setActiveSource({ type: "voiceNote", id });
  }, []);

  /**
   * Called by VoiceNotePlayer when playback ends/pauses/is stopped externally.
   */
  const notifyVoiceNoteStopped = useCallback((id) => {
    setActiveSource((prev) =>
      prev?.type === "voiceNote" && prev?.id === id ? null : prev
    );
  }, []);

  // ─── TTS / useSpeechReader API ────────────────────────────────────────────

  /**
   * Called by useSpeechReader just before it speaks.
   * Stops all playing voice notes.
   */
  const requestSpeechPlay = useCallback((id) => {
    // Stop all voice notes
    stopCallbacksRef.current.forEach((stopFn) => stopFn());

    // Register TTS as active
    setActiveSource({ type: "speech", id });
  }, []);

  /**
   * Called by useSpeechReader when TTS ends/is stopped.
   */
  const notifySpeechStopped = useCallback((id) => {
    setActiveSource((prev) =>
      prev?.type === "speech" && prev?.id === id ? null : prev
    );
  }, []);

  const value = {
    activeSource,
    registerVoiceNote,
    requestVoiceNotePlay,
    notifyVoiceNoteStopped,
    requestSpeechPlay,
    notifySpeechStopped,
  };

  return (
    <AudioCoordinatorContext.Provider value={value}>
      {children}
    </AudioCoordinatorContext.Provider>
  );
}

export function useAudioCoordinator() {
  const ctx = useContext(AudioCoordinatorContext);
  if (!ctx) {
    throw new Error("useAudioCoordinator must be used inside <AudioProvider>");
  }
  return ctx;
}