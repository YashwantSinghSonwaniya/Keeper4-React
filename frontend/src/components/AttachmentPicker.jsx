import React, { useRef } from "react";
import toast from "react-hot-toast";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_ATTACHMENTS = 10;

const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
  "audio/webm",
  "audio/ogg",
  "audio/wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
]);

function AttachmentPicker({
  currentCount,
  onFilesAdded,
  isLoggedIn,
  onGuestAction,
  disabled,
}) {
  const fileInputRef = useRef(null);

  function handleClick() {
    if (!isLoggedIn) {
      if (onGuestAction) onGuestAction();
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  function handleChange(event) {
    // ✅ FIX: this is the one choke point every file selection passes
    // through, however the <input> was triggered. Re-checking here means
    // a guest can never come away with files even if the input itself is
    // reachable (e.g. before the CSS that hides it is confirmed working).
    if (!isLoggedIn) {
      event.target.value = "";
      if (onGuestAction) onGuestAction();
      return;
    }

    const incoming = Array.from(event.target.files || []);
    event.target.value = "";

    if (incoming.length === 0) return;

    const accepted = [];

    incoming.forEach((file) => {
      if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
        toast.error(`${file.name} — unsupported file type.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} — larger than 20MB.`);
        return;
      }
      accepted.push(file);
    });

    if (accepted.length === 0) return;

    const room = MAX_ATTACHMENTS - currentCount;
    if (room <= 0) {
      toast.error(
        `This note already has the maximum of ${MAX_ATTACHMENTS} attachments.`,
      );
      return;
    }

    if (accepted.length > room) {
      toast.error(
        `Only ${room} more file(s) can be added (max ${MAX_ATTACHMENTS} per note).`,
      );
    }

    onFilesAdded(accepted.slice(0, room));
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,audio/*,video/*"
        className="attach-file-input"
        onChange={handleChange}
        // ✅ FIX: previously only reflected the saving state, never login
        // status. A disabled native file input cannot open the OS picker
        // at all, even from a direct click on the control itself.
        disabled={disabled || !isLoggedIn}
      />
      <button
        type="button"
        className="voice-recorder-btn"
        onClick={handleClick}
        title={isLoggedIn ? "Attach files" : "Attachments require an account"}
        disabled={disabled}
      >
        <span className="material-icons">attach_file</span>
      </button>
    </>
  );
}

export default AttachmentPicker;