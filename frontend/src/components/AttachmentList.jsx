import React from "react";
import { getAttachmentKind, formatFileSize } from "../attachmentHelpers";
import { resolveMediaUrl } from "../api";

const KIND_ICONS = {
  image: "image",
  pdf: "picture_as_pdf",
  document: "description",
  spreadsheet: "grid_on",
  presentation: "slideshow",
  text: "article",
  archive: "folder_zip",
  audio: "audiotrack",
  video: "movie",
  file: "attach_file",
};

const PREVIEWABLE_KINDS = new Set(["image", "pdf", "video", "audio"]);

function AttachmentList({ attachments, onDelete, onDownload, isDark, deletingId }) {
  if (!attachments || attachments.length === 0) return null;

  function handlePreview(attachment, kind) {
    if (!PREVIEWABLE_KINDS.has(kind)) return;
    window.open(resolveMediaUrl(attachment.file_path), "_blank", "noopener,noreferrer");
  }

  function stop(event) {
    event.stopPropagation();
  }

  return (
    <div
      className={`attachment-list ${isDark ? "attachment-list-dark" : ""}`}
      onMouseDown={stop}
      onPointerDown={stop}
      onTouchStart={stop}
      onClick={stop}
    >
      {attachments.map((attachment) => {
        const kind = getAttachmentKind(attachment.mime_type);
        const isPreviewable = PREVIEWABLE_KINDS.has(kind);
        const isDeleting = deletingId === attachment.id;

        return (
          <div key={attachment.id} className="attachment-chip">
            {kind === "image" ? (
              <button
                type="button"
                className="attachment-thumb-btn"
                onClick={() => handlePreview(attachment, kind)}
                title={`Preview ${attachment.original_name}`}
              >
                <img
                  src={resolveMediaUrl(attachment.file_path)}
                  alt={attachment.original_name}
                  className="attachment-thumb"
                />
              </button>
            ) : (
              <button
                type="button"
                className="attachment-icon-btn"
                onClick={() => handlePreview(attachment, kind)}
                title={
                  isPreviewable
                    ? `Preview ${attachment.original_name}`
                    : attachment.original_name
                }
                style={{ cursor: isPreviewable ? "pointer" : "default" }}
              >
                <span className="material-icons attachment-icon">
                  {KIND_ICONS[kind]}
                </span>
              </button>
            )}

            <div className="attachment-info">
              <span className="attachment-name" title={attachment.original_name}>
                {attachment.original_name}
              </span>
              <span className="attachment-size">
                {formatFileSize(attachment.file_size)}
              </span>
            </div>

            <div className="attachment-actions">
              <button
                type="button"
                className="attachment-download-btn"
                onClick={() => onDownload(attachment)}
                title="Download"
              >
                <span className="material-icons">download</span>
              </button>
              <button
                type="button"
                className="attachment-delete-btn"
                onClick={() => onDelete(attachment)}
                disabled={isDeleting}
                title="Delete attachment"
              >
                <span className="material-icons">
                  {isDeleting ? "hourglass_empty" : "close"}
                </span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default AttachmentList;