import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

const MAX_RECORDING_MS = 10 * 60 * 1000;
const MIME_TYPE_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function getSupportedMimeType() {
  if (
    typeof window === "undefined" ||
    !window.MediaRecorder ||
    typeof window.MediaRecorder.isTypeSupported !== "function"
  ) {
    return "";
  }

  return MIME_TYPE_CANDIDATES.find((type) =>
    window.MediaRecorder.isTypeSupported(type),
  ) || "";
}

function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

function VoiceRecorder({
  isLoggedIn,
  onRecordingComplete,
  onRecordingDelete,
  onGuestAction,
  disabled,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioDuration, setAudioDuration] = useState(0);
  const [isAttached, setIsAttached] = useState(false);
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const startedAtRef = useRef(0);
  const stopReasonRef = useRef("");
  const audioUrlRef = useRef("");

  function showError(message) {
    setError(message);
    toast.error(message);
  }

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function clearTimer() {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }

  function clearPreview() {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = "";
    }

    setAudioBlob(null);
    setAudioUrl("");
    setAudioDuration(0);
    setRecordingTime(0);
    setIsAttached(false);
    setError("");
    audioChunksRef.current = [];
    if (onRecordingDelete) {
      onRecordingDelete();
    }
  }

  function finishRecording(mediaRecorder) {
    clearTimer();
    stopStream();
    setIsRecording(false);

    const mimeType = mediaRecorder.mimeType || getSupportedMimeType() || "audio/webm";
    const blob = new Blob(audioChunksRef.current, { type: mimeType });
    const duration = Math.min(Date.now() - startedAtRef.current, MAX_RECORDING_MS);

    if (blob.size <= 0 || duration < 500) {
      showError("Recording is empty. Please try again.");
      audioChunksRef.current = [];
      setRecordingTime(0);
      return;
    }

    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    setAudioBlob(blob);
    setAudioUrl(url);
    setAudioDuration(duration);
    setRecordingTime(duration);

    if (stopReasonRef.current === "max") {
      toast.error("Maximum recording time reached.");
    } else {
      toast.success("Recording ready to preview.");
    }
    stopReasonRef.current = "";
  }

  async function startRecording() {
    if (disabled) return;

    if (!isLoggedIn) {
      if (onGuestAction) {
        onGuestAction();
      }
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      showError("Voice recording is not supported in this browser.");
      return;
    }

    clearPreview();
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);

      streamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      startedAtRef.current = Date.now();
      stopReasonRef.current = "";

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = () => {
        showError("Recording failed. Please try again.");
        stopRecording();
      };

      mediaRecorder.onstop = () => finishRecording(mediaRecorder);

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current;
        setRecordingTime(Math.min(elapsed, MAX_RECORDING_MS));

        if (elapsed >= MAX_RECORDING_MS) {
          stopReasonRef.current = "max";
          stopRecording();
        }
      }, 250);
    } catch (err) {
      stopStream();

      if (err.name === "NotAllowedError" || err.name === "SecurityError") {
        showError("Microphone access was denied.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        showError("No microphone was found on this device.");
      } else {
        showError("Could not start recording.");
      }
      console.error("Recording error:", err);
    }
  }

  function stopRecording() {
    const mediaRecorder = mediaRecorderRef.current;

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    } else {
      clearTimer();
      stopStream();
      setIsRecording(false);
    }
  }

  function attachRecording() {
    if (!audioBlob) {
      showError("No recording to attach.");
      return;
    }

    if (audioDuration < 1000) {
      showError("Recording is too short.");
      return;
    }

    setIsAttached(true);
    if (onRecordingComplete) {
      onRecordingComplete({
        blob: audioBlob,
        duration: audioDuration,
        mimeType: audioBlob.type,
      });
    }
    toast.success("Voice note attached.");
  }

  useEffect(() => {
    return () => {
      clearTimer();
      stopStream();

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  return (
    <div className="voice-recorder">
      {!isRecording && !audioUrl && (
        <button
          type="button"
          className="voice-recorder-btn"
          onClick={startRecording}
          title={isLoggedIn ? "Record voice note" : "Voice notes require an account"}
          disabled={disabled}
        >
          <span className="material-icons">mic</span>
        </button>
      )}

      {isRecording && (
        <div className="voice-recording-panel">
          <div className="voice-recording-status">
            <span className="voice-recording-dot"></span>
            <span className="recording-timer">{formatTime(recordingTime)}</span>
          </div>
          <div className="recording-waveform" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <button
            type="button"
            className="voice-control-btn stop-btn"
            onClick={stopRecording}
            title="Stop recording"
          >
            <span className="material-icons">stop_circle</span>
          </button>
        </div>
      )}

      {audioUrl && (
        <div className={`audio-preview ${isAttached ? "audio-preview-attached" : ""}`}>
          <div className="audio-preview-header">
            <span className="material-icons">
              {isAttached ? "check_circle" : "graphic_eq"}
            </span>
            <span className="preview-title">
              {isAttached ? "Voice note attached" : "Preview recording"}
            </span>
            <span className="preview-duration">{formatTime(audioDuration)}</span>
          </div>

          <audio src={audioUrl} controls className="audio-preview-player" />

          <div className="audio-preview-actions">
            <button
              type="button"
              className="voice-text-btn"
              onClick={clearPreview}
              disabled={disabled}
            >
              <span className="material-icons">delete</span>
              Delete
            </button>
            {!isAttached && (
              <button
                type="button"
                className="voice-attach-btn"
                onClick={attachRecording}
                disabled={disabled}
              >
                <span className="material-icons">check</span>
                Attach
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="voice-error">{error}</p>}
    </div>
  );
}

export default VoiceRecorder;
