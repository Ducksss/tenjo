"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Notice } from "./ui";
import { api } from "@/lib/client-api";
export function AdminForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="admin-form"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        const form = new FormData(e.currentTarget);
        const title = String(form.get("title") || "").trim();
        const seriesId = String(form.get("series_id") || "");
        const seriesName = String(form.get("series_name") || "");
        const items = Number(form.get("items"));
        const opens = String(form.get("opens_at"));
        const closes = String(form.get("closes_at"));
        if (
          title.length < 3 ||
          !seriesName ||
          !seriesId ||
          !Number.isInteger(items) ||
          items < 1 ||
          items > 300 ||
          !Number.isFinite(Date.parse(opens)) ||
          !Number.isFinite(Date.parse(closes))
        ) {
          setError(
            "Complete every required field. Use ISO timestamps with +09:00 and 1–300 items.",
          );
          return;
        }
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
              opens_at: opens,
              closes_at: closes,
            }),
          });
          router.push(`/drops/${drop.id}`);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field
        label="Organiser password"
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        hint="The server's ADMIN_PASSWORD. Never saved in this browser."
        required
      />
      <Field
        label="Drop title"
        id="title"
        name="title"
        placeholder="The weekend console drop"
        maxLength={120}
        required
      />
      <Field
        label="Description"
        id="description"
        name="description"
        placeholder="What are people entering for?"
        maxLength={1000}
      />
      <div className="form-columns">
        <Field
          label="Series name"
          id="series_name"
          name="series_name"
          placeholder="Weekend tech club"
          required
        />
        <Field
          label="Series ID"
          id="series_id"
          name="series_id"
          placeholder="weekend-tech"
          hint="Lowercase letters, numbers and hyphens. Reuse to carry losses forward."
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
        required
      />
      <Field
        label="Entries open (JST)"
        id="opens_at"
        name="opens_at"
        placeholder="2026-09-26T09:00:00+09:00"
        hint="Use YYYY-MM-DDTHH:mm:ss+09:00, including the timezone."
        required
      />
      <Field
        label="Entries close (JST)"
        id="closes_at"
        name="closes_at"
        placeholder="2026-09-26T12:00:00+09:00"
        hint="The close must be after the opening time."
        required
      />
      <p className="muted">
        A series can have one unsettled drop at a time. This keeps every ticket
        count consistent.
      </p>
      {error ? <Notice error>{error}</Notice> : null}
      <Button busy={busy} type="submit">
        Create drop
      </Button>
    </form>
  );
}
