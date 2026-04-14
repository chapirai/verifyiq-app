export default function BillingCancelPage() {
  return (
    <section className="space-y-4">
      <h1 className="font-display text-5xl">Checkout canceled</h1>
      <p className="text-sm text-muted-foreground">
        No payment was completed. You can return to billing and try again.
      </p>
      <a className="underline underline-offset-4" href="/billing">Back to billing</a>
    </section>
  );
}
