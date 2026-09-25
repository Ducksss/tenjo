"use client";
import Link from "next/link";
import { Button, Notice } from "@/components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="page-heading">
      <h1>We couldn’t load the record.</h1>
      <Notice error>
        The database may be unavailable. No action has been confirmed. Try
        loading the record again.
      </Notice>
      <div className="button-row">
        <Button onClick={reset}>Try again</Button>
        <Link className="button secondary" href="/">
          Back to drops
        </Link>
      </div>
    </section>
  );
}
