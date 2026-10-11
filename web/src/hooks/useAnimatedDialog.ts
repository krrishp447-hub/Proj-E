"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Native <dialog> (focus trap, Esc, inert page) with a CSS enter/exit transition.
 * `shown` toggles the "show" class; the dialog closes after the exit transition.
 */
export function useAnimatedDialog(exitMs: number) {
  const ref = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  const open = useCallback(() => {
    const d = ref.current;
    if (!d) return;
    window.clearTimeout(closeTimer.current); // reopened mid-exit: cancel the pending close
    if (!d.open) d.showModal();
    requestAnimationFrame(() => setShown(true));
  }, []);

  const close = useCallback(() => {
    setShown(false);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    closeTimer.current = window.setTimeout(() => ref.current?.close(), reduce ? 0 : exitMs);
  }, [exitMs]);

  // Esc fires "cancel"; route it through close() so the exit transition plays.
  const onCancel = useCallback(
    (e: React.SyntheticEvent<HTMLDialogElement>) => {
      e.preventDefault();
      close();
    },
    [close],
  );

  return { ref, shown, open, close, onCancel };
}
