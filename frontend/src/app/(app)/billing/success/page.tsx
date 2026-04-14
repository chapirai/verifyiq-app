export default function BillingSuccessPage() {
  return (
    <section className="space-y-4">
      <h1 className="font-display text-5xl">Billing success</h1>
      <p className="text-sm text-muted-foreground">
        Payment completed. Your subscription is being finalized via webhook and will be active shortly.
      </p>
      <a className="underline underline-offset-4" href="/billing">Back to billing</a>
    </section>
  );
}
