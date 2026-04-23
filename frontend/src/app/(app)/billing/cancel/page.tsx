export default function BillingCancelPage() {
  return (
    <section className="space-y-4">
      <h1 className="font-display text-5xl">Checkout not completed</h1>
      <p className="text-sm text-muted-foreground">
        No charge was made. Return to billing to pick a path and try checkout again.
      </p>
      <a className="underline underline-offset-4" href="/billing">Back to billing</a>
    </section>
  );
}
