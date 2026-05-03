import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface ConfirmDialogProps {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  cancelLabel = "取消",
  confirmLabel = "删除",
  description,
  open,
  title,
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="confirm-dialog-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onClick={onCancel}
        >
          <motion.div
            aria-describedby="confirm-dialog-description"
            aria-labelledby="confirm-dialog-title"
            className="confirm-dialog"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            role="alertdialog"
            transition={{ type: "tween", duration: 0.16, ease: [0.2, 0, 0, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirm-dialog-icon" aria-hidden="true">
              <AlertTriangle size={18} />
            </div>
            <div className="confirm-dialog-copy">
              <h2 id="confirm-dialog-title">{title}</h2>
              <p id="confirm-dialog-description">{description}</p>
            </div>
            <div className="confirm-dialog-actions">
              <button className="confirm-dialog-button ghost" type="button" onClick={onCancel}>
                <X size={16} />
                {cancelLabel}
              </button>
              <button className="confirm-dialog-button danger" type="button" onClick={onConfirm}>
                <Trash2 size={16} />
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
