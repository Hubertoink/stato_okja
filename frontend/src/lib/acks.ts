import { api } from './api';

export async function fetchActivityAcks(activityIds: string[]): Promise<Record<string, boolean>> {
  if (!Array.isArray(activityIds) || activityIds.length === 0) return {};
  const params = new URLSearchParams();
  params.set('activityIds', activityIds.join(','));
  const res = await api.get(`/activities/acks?${params.toString()}`);
  return res.data as Record<string, boolean>;
}

export async function setActivityAck(
  activityId: string,
  done: boolean,
): Promise<{ activityId: string; done: boolean }> {
  const res = await api.patch(`/activities/${encodeURIComponent(activityId)}/ack`, {
    done: !!done,
  });
  return res.data as { activityId: string; done: boolean };
}
