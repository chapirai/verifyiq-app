import { CompanyWorkspace } from '@/components/company/CompanyWorkspace';

export default function CompanyWorkspacePage({ params }: { params: { orgNumber: string } }) {
  return <CompanyWorkspace orgNumberFromRoute={params.orgNumber} />;
}
