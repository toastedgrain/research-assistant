"use client";

import { BookOpenText, Copy, Route, X } from "lucide-react";
import type { SelectionAnchor } from "../../lib/selection/dom";

interface Props {
  anchor: SelectionAnchor;
  onContext: () => void;
  onTrace: () => void;
  onCopy: () => void;
  onClose: () => void;
}

const actionClass =
  "flex h-9 items-center gap-1.5 px-2.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-600 dark:text-neutral-200 dark:hover:bg-neutral-800";

export default function SelectionMenu({
  anchor,
  onContext,
  onTrace,
  onCopy,
  onClose,
}: Props) {
  return (
    <div
      role="toolbar"
      aria-label="Selection actions"
      className="fixed z-50 flex max-w-[calc(100vw-24px)] -translate-x-1/2 overflow-hidden rounded-md border border-neutral-300 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
      style={{ left: anchor.x, top: anchor.y }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <button type="button" className={actionClass} onClick={onContext} title="Show source context">
        <BookOpenText aria-hidden="true" size={15} />
        Context
      </button>
      <button type="button" className={actionClass} onClick={onTrace} title="Trace through paper">
        <Route aria-hidden="true" size={15} />
        Trace
      </button>
      <button type="button" className={actionClass} onClick={onCopy} title="Copy selected text">
        <Copy aria-hidden="true" size={15} />
        Copy
      </button>
      <button
        type="button"
        className="flex h-9 w-9 shrink-0 items-center justify-center border-l border-neutral-200 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        onClick={onClose}
        aria-label="Close selection actions"
      >
        <X aria-hidden="true" size={16} />
      </button>
    </div>
  );
}
