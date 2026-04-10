import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ForgotPasswordPage() {
  return (
    <main className="site-divider min-h-screen py-20">
      <div className="editorial-container max-w-2xl">
        <div className="border-2 border-foreground p-8 md:p-10">
          <p className="mono-label text-[10px]">Credential Recovery</p>
          <h1 className="font-display mt-4 text-5xl">Forgot password</h1>
          <p className="mt-4 text-muted-foreground">
            Password reset endpoint is not exposed in the current backend API. Contact your workspace admin.
          </p>
          <div className="mt-8 space-y-4">
            <Input placeholder="Work email" type="email" disabled />
            <Button disabled className="w-full">Request reset link</Button>
          </div>
          <p className="mt-6 text-sm">
            Back to <Link href="/login" className="underline underline-offset-4">login</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
