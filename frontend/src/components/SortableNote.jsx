import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Note from "./Note";

function SortableNote(props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: "grab",
    zIndex: isDragging ? 999 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Note
        id={props.id}
        title={props.title}
        content={props.content}
        color={props.color}
        isPinned={props.isPinned}
        category={props.category}
        voiceNote={props.voiceNote}
        onDelete={props.onDelete}
        onEdit={props.onEdit}
        onColorChange={props.onColorChange}
        onPin={props.onPin}
        onCategoryChange={props.onCategoryChange}
        onReadAloud={props.onReadAloud}
        onExportPdf={props.onExportPdf}
        speechState={props.speechState}
      />
    </div>
  );
}

export default SortableNote;
