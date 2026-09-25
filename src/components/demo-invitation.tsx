import Link from "next/link";
import { ArrowRight, Ticket } from "lucide-react";
export function DemoInvitation() {
  return (
    <section
      className="demo-invitation"
      aria-labelledby="demo-invitation-title"
    >
      <div>
        <span className="eyebrow">NO ACCOUNT NEEDED / INTERACTIVE EXAMPLE</span>
        <h2 id="demo-invitation-title">
          Take your next chance
          <br />
          for a test run.
        </h2>
        <p>
          Enter, see a loss turn into an extra ticket, then follow a win through
          pickup. Try the whole idea in a minute.
        </p>
        <Link href="/demo" className="button">
          Try the walkthrough <ArrowRight size={18} />
        </Link>
        <span className="demo-invitation-note">
          Scripted results. No real prize or entry.
        </span>
      </div>
      <div className="invitation-ticket" aria-hidden="true">
        <Ticket size={28} />
        <span>3 PAST LOSSES</span>
        <strong>
          4<span>tickets</span>
        </strong>
        <div className="invitation-ticket-rule" />
        <span>YOUR NEXT TRY COUNTS.</span>
      </div>
    </section>
  );
}
