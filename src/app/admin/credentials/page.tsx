import { redirect } from 'next/navigation';
import { getTournamentsAction } from '@/app/actions/tournaments';

export default async function CredentialsDirectorPage() {
  const tourRes = await getTournamentsAction();
  const activeTour = tourRes.tournaments.find((t) => t.is_active) || tourRes.tournaments[0];

  if (activeTour?.id) {
    redirect(`/admin/tournaments/${activeTour.id}?tab=credentials`);
  }

  redirect('/admin/tournaments');
}
