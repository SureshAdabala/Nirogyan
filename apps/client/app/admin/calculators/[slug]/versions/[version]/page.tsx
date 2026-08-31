import { notFound } from 'next/navigation';

import { AdminGate } from '../../../../../../src/admin/auth/AdminGate';
import { StudioPageLoader } from '../../../../../../src/admin/studio/StudioPageLoader';

interface Props {
  readonly params: Promise<{ readonly slug: string; readonly version: string }>;
}

export default async function StudioVersionPage({ params }: Props) {
  const values = await params;
  const versionNumber = Number(values.version);
  if (!Number.isInteger(versionNumber) || versionNumber <= 0) notFound();
  return (
    <AdminGate>
      <StudioPageLoader slug={values.slug} versionNumber={versionNumber} />
    </AdminGate>
  );
}
