"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";

/** Mounted only while an organiser has an unsaved form. Never persists form data. */
export function FormLeaveGuard({ dirty }: { dirty: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  const destination = useRef<URL | null>(null);
  const allowed = useRef(false);
  const router = useRouter();
  useEffect(() => {
    if (!dirty) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      if (allowed.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    function navigate(event: MouseEvent) {
      if (
        allowed.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor =
        event.target instanceof Element ? event.target.closest("a") : null;
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      )
        return;
      const target = new URL(anchor.href, window.location.href);
      if (
        !["http:", "https:"].includes(target.protocol) ||
        (target.origin === location.origin &&
          target.pathname === location.pathname &&
          target.search === location.search)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      destination.current = target;
      dialog.current?.showModal();
      stay.current?.focus();
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
  return (
    <dialog
      ref={dialog}
      className="leave-dialog"
      aria-labelledby="leave-title"
      aria-describedby="leave-description"
    >
      <h2 id="leave-title">Leave this unfinished drop?</h2>
      <p id="leave-description">
        Your changes haven’t been published. Leaving will discard the details
        you’ve entered.
      </p>
      <div className="button-row">
        <button
          ref={stay}
          type="button"
          className="button"
          onClick={() => dialog.current?.close()}
        >
          Keep editing
        </button>
        <Button
          type="button"
          className="secondary"
          onClick={() => {
            const target = destination.current;
            if (!target) return;
            allowed.current = true;
            dialog.current?.close();
            if (target.origin === location.origin)
              router.push(target.pathname + target.search + target.hash);
            else window.location.assign(target.href);
          }}
        >
          Discard and leave
        </Button>
      </div>
    </dialog>
  );
}
