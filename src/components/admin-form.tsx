"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Sparkles } from "lucide-react";
import { Button, Field, Notice, TextAreaField } from "./ui";
import { FormLeaveGuard } from "./form-leave-guard";
import { useNow } from "./use-now";
import { api } from "@/lib/client-api";
import { jstInputToISO, jstInputValue } from "@/lib/date-input";
import { formatJST } from "@/lib/format";
import type { SeriesOption } from "@/lib/service";

const HOUR = 3600000;
const starts = [
  { value: "now", label: "As soon as you publish" },
  { value: "later", label: "At a set time" },
] as const;
const lengths = [
  { value: "15m", label: "15 minutes", ms: HOUR / 4 },
  { value: "1h", label: "1 hour", ms: HOUR },
  { value: "1d", label: "1 day", ms: 24 * HOUR },
  { value: "1w", label: "1 week", ms: 168 * HOUR },
  { value: "custom", label: "Until a set time", ms: 0 },
] as const;
type Start = (typeof starts)[number]["value"];
type Length = (typeof lengths)[number]["value"];

/** A native radio group drawn as pills: arrow keys and screen readers work as usual. */
function Choices<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="choice-group">
      <legend>{legend}</legend>
      <div>
        {options.map((option) => (
          <label className="choice" key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function AdminForm({
  suiNetwork,
  series,
}: {
  suiNetwork?: string | null;
  /** Recent series, so an organiser can continue one instead of retyping its name. */
  series: SeriesOption[];
}) {
  const router = useRouter();
  const now = useNow();
  const submitting = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState("3");
  const [seriesName, setSeriesName] = useState("");
  const [price, setPrice] = useState("");
  const [start, setStart] = useState<Start>("now");
  const [length, setLength] = useState<Length>("1d");
  const [opens, setOpens] = useState("");
  const [closes, setCloses] = useState("");

  const typed = seriesName.trim();
  // The server continues a series by name in the same way (seriesIdFor).
  const match = typed
    ? series.find((s) => s.name.toLowerCase() === typed.toLowerCase())
    : undefined;
  const busySeries = match?.busy
    ? `${match.name} already has a drop waiting for its draw. Run that draw first, or use a new series name.`
    : "";
  const winners = Number(items);
  const validWinners =
    Number.isInteger(winners) && winners >= 1 && winners <= 300;

  /** The entry window as ISO instants; "as soon as you publish" counts from `at`. */
  function windowAt(at: number) {
    const opensAt =
      start === "now" ? new Date(at).toISOString() : jstInputToISO(opens);
    const span = lengths.find((l) => l.value === length)!.ms;
    const closesAt =
      length === "custom"
        ? jstInputToISO(closes)
        : opensAt && new Date(Date.parse(opensAt) + span).toISOString();
    return { opensAt, closesAt };
  }
  const shown = now === null ? null : windowAt(now);
  const valid =
    !!shown?.opensAt && !!shown.closesAt && shown.closesAt > shown.opensAt;
  const summary = !shown
    ? ""
    : !shown.opensAt
      ? "Choose when entries open."
      : !shown.closesAt
        ? "Choose when entries close."
        : !valid
          ? "Entries must close after they open."
          : `${start === "now" ? "Entries open as soon as you publish" : `Entries open ${formatJST(shown.opensAt)}`} and close ${formatJST(shown.closesAt)}.`;

  function touched(...fields: string[]) {
    setDirty(true);
    setError("");
    setErrors((previous) => ({
      ...previous,
      ...Object.fromEntries(fields.map((field) => [field, ""])),
    }));
  }
  function chooseStart(value: Start) {
    // A set time starts from the next full hour, a sensible place to adjust from.
    if (value === "later" && !opens && now !== null)
      setOpens(jstInputValue(new Date(Math.ceil(now / HOUR) * HOUR)));
    setStart(value);
    touched("opens_at", "closes_at");
  }
  function chooseLength(value: Length) {
    // Keep the closing time the organiser was already looking at.
    if (value === "custom" && !closes && shown?.closesAt)
      setCloses(jstInputValue(new Date(shown.closesAt)));
    setLength(value);
    touched("closes_at");
  }
  function example() {
    const tour = series.find((s) => s.name.toLowerCase() === "dome tour 2026");
    setTitle(`Tokyo Dome · Night ${tour ? tour.drops + 1 : 1}`);
    setDescription(
      "A pair of seats for one night of the dome tour. Winners collect them at the venue with a fresh World ID check.",
    );
    setItems("2");
    setSeriesName(tour?.name ?? "Dome tour 2026");
    setStart("now");
    setLength("1h");
    setDirty(true);
    setError("");
    setErrors({});
  }

  return (
    <>
      <FormLeaveGuard dirty={dirty} />
      <div className="organiser-layout">
        <form
          className="admin-panel admin-form"
          noValidate
          onChange={(e) => {
            const name = (e.target as { name?: string }).name;
            if (name && name !== "start" && name !== "length") touched(name);
          }}
          onSubmit={async (e) => {
            e.preventDefault();
            if (submitting.current) return;
            setError("");
            const element = e.currentTarget;
            const password = String(
              new FormData(element).get("password") || "",
            );
            const amount = price.trim();
            const { opensAt, closesAt } = windowAt(Date.now());
            const nextErrors: Record<string, string> = {};
            if (title.trim().length < 3)
              nextErrors.title =
                "Give the drop a title of at least 3 characters.";
            if (typed.length < 2)
              nextErrors.series_name =
                "Name the series, such as Dome tour 2026, in at least 2 characters.";
            else if (busySeries) nextErrors.series_name = busySeries;
            if (!validWinners)
              nextErrors.items = "Choose a whole number from 1 to 300.";
            if (
              amount &&
              (!/^\d{1,4}(\.\d{1,9})?$/.test(amount) || Number(amount) <= 0)
            )
              nextErrors.price =
                "Enter an amount in SUI, such as 0.01, or leave it empty for a free drop.";
            if (!opensAt)
              nextErrors.opens_at = "Choose a valid opening date and time.";
            else if (!closesAt)
              nextErrors.closes_at = "Choose a valid closing date and time.";
            else if (closesAt <= opensAt)
              nextErrors.closes_at = "Closing time must be after opening time.";
            if (!password)
              nextErrors.password =
                "Enter your organiser password to publish this drop.";
            setErrors(nextErrors);
            if (Object.keys(nextErrors).length) {
              setError(
                "Some details need another look. Check the highlighted fields below.",
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
                  authorization: `Bearer ${password}`,
                },
                body: JSON.stringify({
                  title: title.trim(),
                  description: description.trim(),
                  ...(match
                    ? { series_id: match.id, series_name: match.name }
                    : { series_name: typed }),
                  items: winners,
                  opens_at: opensAt,
                  closes_at: closesAt,
                  ...(amount ? { price: amount } : {}),
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
          <div className="form-intro">
            <p>
              <strong>Not sure what to write?</strong> Start from a sample
              concert ballot, then change anything you like.
            </p>
            <Button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={example}
            >
              Fill in an example <Sparkles size={16} />
            </Button>
          </div>
          {error ? <Notice error>{error}</Notice> : null}
          <fieldset disabled={busy} className="form-section">
            <legend>
              <span>01</span> What can fans win?
            </legend>
            <Field
              label="Drop title"
              id="title"
              name="title"
              placeholder="Tokyo Dome · Night 1"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={errors.title}
              required
            />
            <TextAreaField
              label="Details for fans (optional)"
              id="description"
              name="description"
              placeholder="What’s included, and how do winners collect it?"
              maxLength={1000}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Field
              label="Number of winners"
              id="items"
              name="items"
              type="number"
              inputMode="numeric"
              min={1}
              max={300}
              value={items}
              onChange={(e) => setItems(e.target.value)}
              error={errors.items}
              hint="Each winner gets one item: a pair of seats, a pass, a console. Up to 300."
              required
            />
            {suiNetwork ? (
              <Field
                label="Entry deposit in SUI (optional)"
                id="price"
                name="price"
                inputMode="decimal"
                placeholder="0.01"
                maxLength={14}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                hint={`Leave empty for a free drop. Winners pay the deposit for their item; losers get it back in the settlement transaction on Sui ${suiNetwork}.`}
                error={errors.price}
              />
            ) : null}
          </fieldset>
          <fieldset disabled={busy} className="form-section">
            <legend>
              <span>02</span> Which series is it part of?
            </legend>
            <p className="form-lede">
              A series is a run of drops that share one loss count, like the
              nights of a tour or a shop’s restocks. Fans who lose one drop get
              an extra chance in the next drop of the same series.
            </p>
            <Field
              label="Series name"
              id="series_name"
              name="series_name"
              placeholder="Dome tour 2026"
              maxLength={100}
              autoComplete="off"
              value={seriesName}
              onChange={(e) => setSeriesName(e.target.value)}
              error={errors.series_name}
              aria-describedby={
                typed.length >= 2 && !errors.series_name
                  ? "series-status"
                  : undefined
              }
              required
            />
            {typed.length >= 2 && !errors.series_name ? (
              <p
                id="series-status"
                className={`series-status${busySeries ? " warn" : ""}`}
              >
                {busySeries ||
                  (match
                    ? `Continues ${match.name}: ${match.drops} drop${match.drops === 1 ? "" : "s"} so far. Fans who lost there get their extra chances here.`
                    : "Starts a new series. Everyone’s first entry has one chance.")}
              </p>
            ) : null}
            {series.length ? (
              <div className="series-picks">
                <span id="series-picks-label">Or continue one of yours:</span>
                <ul aria-labelledby="series-picks-label">
                  {series.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="series-pick"
                        aria-pressed={match?.id === s.id}
                        disabled={s.busy}
                        onClick={() => {
                          setSeriesName(s.name);
                          touched("series_name");
                        }}
                      >
                        {s.name}
                        <small>
                          {s.busy
                            ? "awaiting draw"
                            : `${s.drops} drop${s.drops === 1 ? "" : "s"}`}
                        </small>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </fieldset>
          <fieldset disabled={busy} className="form-section">
            <legend>
              <span>03</span> When can fans enter?
            </legend>
            <p className="form-lede">
              Times are Japan Standard Time (UTC+9), wherever you are.
            </p>
            <Choices
              legend="Entries open"
              name="start"
              value={start}
              options={starts}
              onChange={chooseStart}
            />
            {start === "later" ? (
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
            ) : null}
            <Choices
              legend="Open for"
              name="length"
              value={length}
              options={lengths}
              onChange={chooseLength}
            />
            {length === "custom" ? (
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
            ) : null}
            <p
              className={`schedule-summary${shown && !valid ? " warn" : ""}`}
              aria-live="polite"
            >
              {summary}
            </p>
          </fieldset>
          <fieldset disabled={busy} className="form-section">
            <legend>
              <span>04</span> Publish
            </legend>
            <div className="password-field">
              <Field
                label="Organiser password"
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                hint="Ask your team for it. It’s sent once to publish and never saved in your browser."
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
              Publishing makes the drop public straight away, with its own page
              to share with fans.
            </p>
            <Button busy={busy} type="submit">
              Create drop <ArrowRight size={18} />
            </Button>
          </fieldset>
        </form>
        <aside className="organiser-aside">
          <div className="drop-preview" aria-hidden="true">
            <span className="eyebrow">Preview · what fans will see</span>
            <div className="drop-preview-card">
              <div className="drop-preview-top">
                <span>{typed || "Your series"}</span>
                <span className="pill">
                  <span
                    className={`status-dot ${start === "now" ? "live" : ""}`}
                  />
                  {start === "now" ? "Entries open" : "Opens soon"}
                </span>
              </div>
              <strong className="drop-preview-title">
                {title.trim() || "Your drop title"}
              </strong>
              {description.trim() ? <p>{description.trim()}</p> : null}
              <dl>
                <div>
                  <dt>Winners</dt>
                  <dd>{validWinners ? winners : "–"}</dd>
                </div>
                <div>
                  <dt>{start === "now" ? "Closes" : "Opens"}</dt>
                  <dd>
                    {!valid || !shown
                      ? "–"
                      : formatJST(
                          start === "now" ? shown.closesAt! : shown.opensAt!,
                        )}
                  </dd>
                </div>
              </dl>
              <p className="drop-preview-foot">
                {price.trim()
                  ? `${price.trim()} SUI refundable deposit`
                  : "Free to enter"}{" "}
                · One entry per person, with World ID
              </p>
            </div>
          </div>
          <section
            className="drop-lifecycle"
            aria-labelledby="lifecycle-heading"
          >
            <h2 id="lifecycle-heading">What happens after you publish</h2>
            <ol>
              <li>
                <strong>Fans enter once.</strong> World ID lets each real person
                in one time. Each gets one chance, plus one for every earlier
                loss in the series, up to six.
              </li>
              <li>
                <strong>Anyone runs the draw.</strong> When entries close,{" "}
                <em>Run draw</em> unlocks on the drop page. Winners are picked
                at random, weighted by chances.
              </li>
              <li>
                <strong>Winners collect.</strong> Pickup takes a fresh World ID
                check. Everyone who lost starts the series’ next drop with one
                more chance.
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}
