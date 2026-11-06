import { redirect } from 'next/navigation';
import { getTournamentsAction } from '@/app/actions/tournaments';

export default async function WeighInDirectorPage() {
  const tourRes = await getTournamentsAction();
  const activeTour = tourRes.tournaments.find((t) => t.is_active) || tourRes.tournaments[0];

  if (activeTour?.id) {
    redirect(`/admin/tournaments/${activeTour.id}?tab=weigh_in`);
  }

  redirect('/admin/tournaments');
}
