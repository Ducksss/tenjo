import { Walkthrough } from "@/components/walkthrough";
export const metadata = {
  title: "Try the walkthrough",
  description:
    "Follow one fan through two concert ballots: World ID entry, a loss that adds a chance, a win and a pickup. Scripted; no account or World ID needed.",
};
export default function Demo() {
  return (
    <>
      <section className="page-heading walkthrough-heading">
        <span className="eyebrow">A MINUTE TO GET THE IDEA</span>
        <h1>Your next try is different.</h1>
        <p>
          Follow one fan through the ballots for two nights of a sold-out dome
          tour. Verify once with World ID, lose Night 1, carry an extra chance
          into Night 2, win, and collect the seats.
        </p>
      </section>
      <Walkthrough />
    </>
  );
}
