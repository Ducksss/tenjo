import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { LoaderCircle } from "lucide-react";
export function Button({
  busy,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
      className={`button ${className}`}
    >
      {busy ? (
        <LoaderCircle size={18} className="spin" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`notice ${error ? "notice-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
type FieldProps = { label: string; hint?: string; error?: string };
function describedBy(
  id: string | undefined,
  { hint, error }: FieldProps,
  extra?: string,
) {
  return (
    [hint ? `${id}-hint` : "", error ? `${id}-error` : "", extra || ""]
      .filter(Boolean)
      .join(" ") || undefined
  );
}
function FieldNotes({ id, hint, error }: FieldProps & { id?: string }) {
  return (
    <>
      {hint ? <small id={`${id}-hint`}>{hint}</small> : null}
      {error ? (
        <small className="field-error" id={`${id}-error`}>
          {error}
        </small>
      ) : null}
    </>
  );
}
export function Field({
  label,
  hint,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(
          id,
          { label, hint, error },
          props["aria-describedby"],
        )}
      />
      <FieldNotes id={id} label={label} hint={hint} error={error} />
    </div>
  );
}
export function TextAreaField({
  label,
  hint,
  error,
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(
          id,
          { label, hint, error },
          props["aria-describedby"],
        )}
      />
      <FieldNotes id={id} label={label} hint={hint} error={error} />
    </div>
  );
}
