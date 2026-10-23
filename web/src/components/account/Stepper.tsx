"use client";

import { useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import "./account.css";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="acct-btn on-ink" disabled={pending}>{pending ? "Saving…" : label}</button>;
}

/**
 * One <form>, several steps. Every step stays in the DOM (hidden), so the final submit sends all fields to the
 * server action; "Continue" only advances once the current step's own fields are valid.
 */
export function Stepper({ action, steps, submitLabel }: { action: (fd: FormData) => Promise<void>; steps: { title: string; body: ReactNode }[]; submitLabel: string }) {
  const [i, setI] = useState(0);
  const sets = useRef<(HTMLFieldSetElement | null)[]>([]);
  const next = () => {
    const fs = sets.current[i];
    if (fs && [...fs.elements].every((el) => !(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) || el.reportValidity())) setI(i + 1);
  };
  const last = i === steps.length - 1;

  return (
    <form
      className="acct-form"
      action={action}
      // Enter in a text field advances a step instead of submitting the whole form early
      onKeyDown={(e) => { if (e.key === "Enter" && !last && e.target instanceof HTMLInputElement) { e.preventDefault(); next(); } }}
    >
      <ol className="acct-steps" aria-label="Steps">
        {steps.map((s, k) => (
          <li key={s.title} aria-current={k === i ? "step" : undefined} className={k < i ? "is-done" : ""}>{k + 1} · {s.title}</li>
        ))}
      </ol>
      {steps.map((s, k) => (
        <fieldset key={s.title} ref={(el) => { sets.current[k] = el; }} hidden={k !== i}>
          <legend>{s.title}</legend>
          {s.body}
        </fieldset>
      ))}
      <div className="acct-nav">
        {i > 0 ? <button type="button" className="acct-btn ghost" onClick={() => setI(i - 1)}>← Back</button> : <span />}
        {last ? <Submit label={submitLabel} /> : <button type="button" className="acct-btn on-ink" onClick={next}>Continue <span className="arw">→</span></button>}
      </div>
    </form>
  );
}
