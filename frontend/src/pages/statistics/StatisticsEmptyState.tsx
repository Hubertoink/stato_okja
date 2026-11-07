import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import activityIllustration from '../../../assets/Illust_Amigos/Aktivitäten.svg';

export function StatisticsEmptyState({ firstActivity = false, team = false }: {
  firstActivity?: boolean;
  team?: boolean;
}) {
  const navigate = useNavigate();
  return <EmptyState
    illustration={activityIllustration}
    title={firstActivity ? 'Noch keine Aktivitäten vorhanden' : team ? 'Keine passenden Team-Einsätze' : 'Keine passenden Aktivitäten'}
    description={firstActivity
      ? 'Erstelle deine erste Aktivität. Sobald Daten vorliegen, findest du hier die Auswertung.'
      : team
        ? 'Für diese Auswahl liegen keine zugeordneten Team-Einsätze vor. Passe die Filter an oder dokumentiere eine Aktivität mit Mitarbeitenden.'
        : 'Für den gewählten Zeitraum und die gesetzten Filter liegen keine Aktivitäten vor. Passe die Filter an oder erstelle eine neue Aktivität.'}
    action={<Button onClick={() => navigate('/activities/new/select-project')}>
      {firstActivity ? 'Erste Aktivität erstellen' : 'Aktivität erstellen'}
    </Button>}
  />;
}
