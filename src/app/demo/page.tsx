import { Walkthrough } from "@/components/walkthrough";
export const metadata = {
  title: "Try the walkthrough",
  description:
    "Explore Tenjō’s ticket, draw and pickup rules in a scripted example. No account or World ID needed.",
};
export default function Demo() {
  return (
    <>
      <section className="page-heading walkthrough-heading">
        <span className="eyebrow">A MINUTE TO GET THE IDEA</span>
        <h1>Your next try is different.</h1>
        <p>
          Follow one fan through two example drops. See what a loss earns, what
          a win resets, and why only the winner can collect.
        </p>
      </section>
      <Walkthrough />
    </>
  );
}
