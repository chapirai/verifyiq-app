import Link from 'next/link';

export default function ResetPasswordPage() {
  return (
    <main className="site-divider min-h-screen py-20">
      <div className="editorial-container max-w-2xl">
        <div className="border-2 border-foreground p-8 md:p-10">
          <p className="mono-label text-[10px]">Reset Link</p>
          <h1 className="font-display mt-4 text-5xl">Reset password</h1>
          <p className="mt-4 text-muted-foreground">
            Reset flow requires backend token endpoints that are not available in this repository yet.
          </p>
          <p className="mt-6 text-sm">
            Return to <Link href="/login" className="underline underline-offset-4">login</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
