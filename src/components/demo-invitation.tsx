import Link from "next/link";
import { ArrowRight, Ticket } from "lucide-react";
export function DemoInvitation() {
  return (
    <section
      className="demo-invitation"
      aria-labelledby="demo-invitation-title"
    >
      <div>
        <span className="eyebrow">No account needed · interactive example</span>
        <h2 id="demo-invitation-title">
          Try a concert ballot
          <br />
          in a minute.
        </h2>
        <p>
          Verify with World ID, lose the Night 1 ballot, carry an extra chance
          into Night 2, then win and collect your seats.
        </p>
        <Link href="/demo" className="button">
          Try the walkthrough <ArrowRight size={18} />
        </Link>
        <span className="demo-invitation-note">
          Scripted results. No real ticket or entry.
        </span>
      </div>
      <div className="invitation-ticket" aria-hidden="true">
        <Ticket size={28} />
        <span>3 PAST LOSSES</span>
        <strong>
          4<span>chances</span>
        </strong>
        <div className="invitation-ticket-rule" />
        <span>YOUR NEXT TRY COUNTS.</span>
      </div>
    </section>
  );
}
