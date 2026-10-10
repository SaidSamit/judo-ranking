import { TatamiQueueView } from '@/components/admin/tatami-queue-view';

interface TatamiPageProps {
  params: Promise<{ id: string }>;
}

export default async function TatamiAdminPage({ params }: TatamiPageProps) {
  const { id } = await params;
  const tatamiNumber = parseInt(id.replace(/\D/g, '') || '1', 10);

  return <TatamiQueueView tatamiNumber={tatamiNumber} rawId={id} />;
}
