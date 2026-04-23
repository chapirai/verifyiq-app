export default function BillingSuccessPage() {
  return (
    <section className="space-y-4">
      <h1 className="font-display text-5xl">Access activated</h1>
      <p className="text-sm text-muted-foreground">
        Your checkout completed and your billing path is being finalized. Access updates normally appear within a few moments.
      </p>
      <a className="underline underline-offset-4" href="/billing">Back to billing</a>
    </section>
  );
}
