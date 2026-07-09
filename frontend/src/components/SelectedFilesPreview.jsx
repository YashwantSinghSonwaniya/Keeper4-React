import React from "react";
import { getAttachmentKind, formatFileSize } from "../attachmentHelpers";

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

function SelectedFilesPreview({ files, onRemove, disabled }) {
  if (!files || files.length === 0) return null;

  return (
    <div className="selected-files-list">
      {files.map((file, index) => {
        const kind = getAttachmentKind(file.type);
        return (
          <div key={`${file.name}-${index}`} className="selected-file-chip">
            <span className="material-icons selected-file-icon">
              {KIND_ICONS[kind]}
            </span>
            <span className="selected-file-name" title={file.name}>
              {file.name}
            </span>
            <span className="selected-file-size">
              {formatFileSize(file.size)}
            </span>
            <button
              type="button"
              className="selected-file-remove"
              onClick={() => onRemove(index)}
              disabled={disabled}
              title="Remove file"
            >
              <span className="material-icons">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default SelectedFilesPreview;