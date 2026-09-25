"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Clock3, ArrowRight } from "lucide-react";
import { Button, Field, Notice } from "./ui";
import { FormLeaveGuard } from "./form-leave-guard";
import { api } from "@/lib/client-api";
import { jstInputToISO, jstInputValue } from "@/lib/date-input";

export function AdminForm() {
  const router = useRouter();
  const submitting = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [opens, setOpens] = useState("");
  const [closes, setCloses] = useState("");
  function scheduleHour() {
    setDirty(true);
    const now = new Date();
    setOpens(jstInputValue(now));
    setCloses(jstInputValue(new Date(now.getTime() + 3600000)));
    setErrors((previous) => ({ ...previous, opens_at: "", closes_at: "" }));
  }
  return (
    <>
      <FormLeaveGuard dirty={dirty} />
      <form
        className="admin-form"
        noValidate
        onChange={(e) => {
          const target = e.target;
          if (!(target instanceof HTMLInputElement)) return;
          setDirty(true);
          setErrors((previous) => ({ ...previous, [target.name]: "" }));
          setError("");
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (submitting.current) return;
          setError("");
          const element = e.currentTarget;
          const form = new FormData(element);
          const title = String(form.get("title") || "").trim();
          const seriesId = String(form.get("series_id") || "").trim();
          const seriesName = String(form.get("series_name") || "").trim();
          const items = Number(form.get("items"));
          const opensAt = jstInputToISO(opens);
          const closesAt = jstInputToISO(closes);
          const nextErrors: Record<string, string> = {};
          if (title.length < 3)
            nextErrors.title = "Give the drop a name of at least 3 characters.";
          if (seriesName.length < 2)
            nextErrors.series_name =
              "Enter a series name of at least 2 characters.";
          if (!/^[a-z0-9-]{1,64}$/.test(seriesId))
            nextErrors.series_id =
              "Use 1–64 lowercase letters, numbers or hyphens, such as weekend-tech.";
          if (!Number.isInteger(items) || items < 1 || items > 300)
            nextErrors.items = "Choose a whole number from 1 to 300.";
          if (!opensAt)
            nextErrors.opens_at = "Choose a valid opening date and time.";
          if (!closesAt)
            nextErrors.closes_at = "Choose a valid closing date and time.";
          else if (opensAt && closesAt <= opensAt)
            nextErrors.closes_at = "Closing time must be after opening time.";
          if (!form.get("password"))
            nextErrors.password =
              "Enter your organiser password to publish this drop.";
          setErrors(nextErrors);
          if (Object.keys(nextErrors).length) {
            setError(
              "Complete every required field. Check the highlighted details below.",
            );
            const field = element.elements.namedItem(
              Object.keys(nextErrors)[0],
            );
            if (field instanceof HTMLElement) field.focus();
            return;
          }
          submitting.current = true;
          setBusy(true);
          try {
            const drop = await api<{ id: string }>("/api/admin/drops", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${form.get("password")}`,
              },
              body: JSON.stringify({
                title,
                description: form.get("description"),
                series_id: seriesId,
                series_name: seriesName,
                items,
                opens_at: opensAt,
                closes_at: closesAt,
              }),
            });
            setDirty(false);
            router.push(`/drops/${drop.id}`);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            submitting.current = false;
            setBusy(false);
          }
        }}
      >
        {error ? <Notice error>{error}</Notice> : null}
        <fieldset disabled={busy} className="form-section">
          <legend>
            <span>01</span> The drop
          </legend>
          <Field
            label="Drop title"
            id="title"
            name="title"
            placeholder="The weekend console drop"
            maxLength={120}
            error={errors.title}
            required
          />
          <Field
            label="Description (optional)"
            id="description"
            name="description"
            placeholder="What’s included, and how will winners collect?"
            maxLength={1000}
          />
          <div className="form-columns">
            <Field
              label="Series name"
              id="series_name"
              name="series_name"
              placeholder="Weekend tech club"
              maxLength={100}
              hint="Losses carry forward between drops in the same series."
              error={errors.series_name}
              required
            />
            <Field
              label="Series ID"
              id="series_id"
              name="series_id"
              placeholder="weekend-tech"
              maxLength={64}
              hint="Reuse the same ID for the next drop in this series."
              error={errors.series_id}
              required
            />
          </div>
          <Field
            label="Items to win"
            id="items"
            name="items"
            type="number"
            defaultValue={3}
            min={1}
            max={300}
            error={errors.items}
            hint="One item per winner. Up to 300 items."
            required
          />
        </fieldset>
        <fieldset disabled={busy} className="form-section">
          <legend>
            <span>02</span> Entry window
          </legend>
          <div className="schedule-hint">
            <p>
              All dates and times are in{" "}
              <strong>Japan Standard Time (UTC+9)</strong>, wherever you are.
            </p>
            <button
              type="button"
              className="text-button"
              onClick={scheduleHour}
            >
              <Clock3 size={16} />
              Start now · close in 1 hour
            </button>
          </div>
          <div className="form-columns">
            <Field
              label="Entries open (JST)"
              id="opens_at"
              name="opens_at"
              type="datetime-local"
              value={opens}
              onChange={(e) => setOpens(e.target.value)}
              error={errors.opens_at}
              required
            />
            <Field
              label="Entries close (JST)"
              id="closes_at"
              name="closes_at"
              type="datetime-local"
              value={closes}
              onChange={(e) => setCloses(e.target.value)}
              error={errors.closes_at}
              required
            />
          </div>
          <p className="small muted">
            Once entries close, anyone can run the draw. A series can have one
            unsettled drop at a time.
          </p>
        </fieldset>
        <fieldset disabled={busy} className="form-section">
          <legend>
            <span>03</span> Publish your drop
          </legend>
          <div className="password-field">
            <Field
              label="Organiser password"
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              hint="Use the password provided by your team. We don’t store it in the app’s browser storage."
              error={errors.password}
              required
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={
                showPassword
                  ? "Hide organiser password"
                  : "Show organiser password"
              }
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p className="small muted">
            Creating a drop makes its details public. Entries open at the time
            you choose.
          </p>
          <Button busy={busy} type="submit">
            Create drop <ArrowRight size={18} />
          </Button>
        </fieldset>
      </form>
    </>
  );
}
