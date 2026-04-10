import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';

const stats = [
  ['+127%', 'Growth rate'],
  ['500k+', 'Active users'],
  ['99.99%', 'Uptime SLA'],
  ['24/7', 'Support access'],
];

export function SocialProof() {
  return (
    <section className="py-20 md:py-24">
      <Container className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {stats.map(([value, label]) => (
          <Card key={label} className="p-6">
            <p className="text-3xl font-semibold text-[#0F172A]">{value}</p>
            <p className="mt-2 text-sm text-[#64748B]">{label}</p>
          </Card>
        ))}
      </Container>
    </section>
  );
}
