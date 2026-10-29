import i18n from '@/i18n';
import type { InviteUserResult } from './orgs';

export function invitationFeedback(result: InviteUserResult): string {
  const outcome = result.outcome || (result.emailQueued ? 'invited' : 'access_added');
  return i18n.t(`invitationFeedback.${outcome}`, { ns: 'common' });
}
