import { SectionHeader } from '@/components/section-header';

export default function SettingsPage() {
  return (
    <section className="space-y-6">
      <SectionHeader
        eyebrow="Workspace Settings"
        title="Team and Security"
        description="Manage workspace profile, user access, and account security controls."
      />
      <div className="panel p-6">
        <p className="text-muted-foreground">
          Settings foundation for workspace profile, user management, and security controls.
        </p>
      </div>
    </section>
  );
}
