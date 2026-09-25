"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { Button, Notice } from "./ui";
export function Lookup({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <form
      noValidate
      className="lookup-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!/^[a-f0-9]{32}$/i.test(value.trim())) {
          setError("Enter the full 32-character code from your entry receipt.");
          return;
        }
        setError("");
        router.push(`/codes/${value.trim().toLowerCase()}`);
      }}
    >
      <label htmlFor="code-lookup">Look up my anonymous code</label>
      <div className="lookup-row">
        <Search size={19} aria-hidden="true" />
        <input
          id="code-lookup"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          placeholder="Your 32-character code"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? "lookup-error" : undefined}
        />
        {value ? (
          <button
            type="button"
            className="clear-button"
            onClick={() => {
              setValue("");
              setError("");
            }}
            aria-label="Clear code"
          >
            ×
          </button>
        ) : null}
        <Button type="submit">
          Look up
          <ArrowRight size={16} />
        </Button>
      </div>
      <div id="lookup-error">
        {error ? <Notice error>{error}</Notice> : null}
      </div>
    </form>
  );
}
