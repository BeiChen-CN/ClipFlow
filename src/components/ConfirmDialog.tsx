import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { createMotionSettings } from "../domain/motion";
import type { MotionPreset } from "../domain/types";

interface ConfirmDialogProps {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  motionPreset?: MotionPreset;
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  cancelLabel = "取消",
  confirmLabel = "删除",
  description,
  motionPreset = "a",
  open,
  title,
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  const motionSettings = useMemo(() => createMotionSettings(motionPreset), [motionPreset]);

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
          data-motion-preset={motionPreset}
          initial={motionSettings.confirmDialogMotion.backdropInitial}
          animate={motionSettings.confirmDialogMotion.backdropAnimate}
          exit={motionSettings.confirmDialogMotion.backdropExit}
          transition={motionSettings.confirmDialogMotion.backdropTransition}
          onClick={onCancel}
        >
          <motion.div
            aria-describedby="confirm-dialog-description"
            aria-labelledby="confirm-dialog-title"
            className="confirm-dialog"
            initial={motionSettings.confirmDialogMotion.dialogInitial}
            animate={motionSettings.confirmDialogMotion.dialogAnimate}
            exit={motionSettings.confirmDialogMotion.dialogExit}
            role="alertdialog"
            transition={motionSettings.confirmDialogMotion.dialogTransition}
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
