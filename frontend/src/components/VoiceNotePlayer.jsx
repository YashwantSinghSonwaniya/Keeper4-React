import React, { useRef, useState } from "react";
import toast from "react-hot-toast";
import { resolveMediaUrl } from "../api";

function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

function VoiceNotePlayer({ voiceNote, isDark }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(voiceNote?.duration || 0);
  const [error, setError] = useState("");

  if (!voiceNote?.audio_url) {
    return null;
  }

  const audioUrl = resolveMediaUrl(voiceNote.audio_url);
  const displayDuration = duration || voiceNote.duration || 0;
  const progressPercent = displayDuration
    ? Math.min((currentTime * 1000 / displayDuration) * 100, 100)
    : 0;

  function stopPlayerEvent(event) {
    event.stopPropagation();
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      console.error("Voice playback error:", err);
      setError("Could not play audio.");
      toast.error("Could not play voice note.");
    }
  }

  function handleLoadedMetadata() {
    const audio = audioRef.current;
    setIsLoading(false);

    if (audio && Number.isFinite(audio.duration)) {
      setDuration(Math.round(audio.duration * 1000));
    }
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (audio) {
      setCurrentTime(audio.currentTime);
    }
  }

  function handleSeek(event) {
    const audio = audioRef.current;
    const nextTime = Number(event.target.value);

    if (audio && Number.isFinite(nextTime)) {
      audio.currentTime = nextTime;
      setCurrentTime(nextTime);
    }
  }

  function handleEnded() {
    setIsPlaying(false);
    setCurrentTime(0);
  }

  function handleError() {
    setIsLoading(false);
    setError("Audio unavailable.");
  }

  return (
    <div
      className={`voice-note-player ${isDark ? "dark" : ""}`}
      onPointerDown={stopPlayerEvent}
      onMouseDown={stopPlayerEvent}
      onTouchStart={stopPlayerEvent}
      onClick={stopPlayerEvent}
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onError={handleError}
      />

      <button
        type="button"
        className="voice-play-btn"
        onClick={togglePlayback}
        disabled={Boolean(error)}
        title={isPlaying ? "Pause voice note" : "Play voice note"}
      >
        <span className="material-icons">
          {isPlaying ? "pause" : "play_arrow"}
        </span>
      </button>

      <div className="voice-player-main">
        <div className="voice-player-header">
          <span className="material-icons voice-player-icon">mic</span>
          <span className="voice-player-label">Voice note</span>
          <span className="voice-player-duration">
            {isLoading ? "--:--" : formatTime(displayDuration)}
          </span>
        </div>

        <div className="voice-seek-wrap">
          <div
            className="voice-seek-fill"
            style={{ width: `${progressPercent}%` }}
          ></div>
          <input
            type="range"
            min="0"
            max={displayDuration ? displayDuration / 1000 : 0}
            step="0.01"
            value={currentTime}
            onChange={handleSeek}
            aria-label="Seek voice note"
            className="voice-seek-input"
          />
        </div>

        <div className="voice-time-row">
          <span>{formatTime(currentTime * 1000)}</span>
          {error ? <span className="voice-player-error">{error}</span> : null}
        </div>
      </div>
    </div>
  );
}

export default VoiceNotePlayer;
