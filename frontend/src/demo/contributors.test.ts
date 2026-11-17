import axios from 'axios';
import { beforeEach, describe, expect, it } from 'vitest';
import { demoAxiosAdapter } from './adapter';
import { resetDemoStore } from './store';
import type { Contributor, ContributionEntry } from '@/lib/contributors';
import type { Activity } from '@/lib/activities';

const api = axios.create({ baseURL: '/api', adapter: demoAxiosAdapter });

describe('demo contributor API', () => {
  beforeEach(() => resetDemoStore());

  it('loads the master data and supports creating, editing, archiving and restoring people', async () => {
    const initial = (await api.get<Contributor[]>('/contributors')).data;
    expect(initial.some(person => person.active)).toBe(true);
    const { data: person, status } = await api.post<Contributor>('/contributors', { name: ' Alex Demo ', color: '#123456' });
    expect(status).toBe(201);
    expect(person).toMatchObject({ name: 'Alex Demo', color: '#123456', active: true });
    await api.patch(`/contributors/${person.id}`, { name: 'Alex Neu', color: '#654321', active: false });
    expect((await api.get<Contributor[]>('/contributors')).data).toContainEqual({ ...person, name: 'Alex Neu', color: '#654321', active: false });
    await api.patch(`/contributors/${person.id}`, { active: true });
    expect((await api.get<Contributor[]>('/contributors')).data.find(entry => entry.id === person.id)?.active).toBe(true);
  });

  it('preserves activity contributions, filters them, and reports only completed activities in the selected range', async () => {
    const person = (await api.post<Contributor>('/contributors', { name: 'Alex' })).data;
    const contributions = [{ contributorId: person.id, minutes: 45 }];
    const activity = (await api.post<Activity>('/activities', { date: '2001-01-15', startTime: '10:00', endTime: '12:00', contributions })).data;
    expect(activity.contributions).toEqual(contributions);
    await api.patch(`/activities/${activity.id}`, { title: 'Mitwirkung testen' });
    expect((await api.get<Activity>(`/activities/${activity.id}`)).data.contributions).toEqual(contributions);
    const params = { from: activity.date, to: activity.date, projectId: activity.projectId };
    const report = (await api.get<ContributionEntry[]>('/contributors/report', { params })).data;
    expect(report).toEqual([expect.objectContaining({ ...contributions[0], name: 'Alex', activityId: activity.id, title: 'Mitwirkung testen' })]);
    expect((await api.get('/stats/overview', { params })).data.contributions).toEqual(report);
    expect((await api.get<Activity[]>('/activities', { params: { contributorIds: person.id } })).data.map(entry => entry.id)).toEqual([activity.id]);
    expect((await api.get('/contributors/report', { params: { ...params, projectId: 'other-project' } })).data).toEqual([]);
    expect((await api.get('/contributors/report', { params: { from: '2001-01-16', to: '2001-01-16' } })).data).toEqual([]);
    await api.patch(`/contributors/${person.id}`, { active: false });
    expect((await api.get('/contributors/report', { params })).data[0].active).toBe(false);
    await api.patch(`/activities/${activity.id}`, { contributions: [], executionStatus: 'cancelled' });
    expect((await api.get('/contributors/report', { params })).data).toEqual([]);
  });

  it('counts usage and removes only the deleted person from activities and statistics', async () => {
    const first = (await api.post<Contributor>('/contributors', { name: 'First' })).data;
    const second = (await api.post<Contributor>('/contributors', { name: 'Second' })).data;
    const activity = (await api.post<Activity>('/activities', { date: '2001-01-15', durationMinutes: 120, contributions: [
      { contributorId: first.id, minutes: 45 }, { contributorId: second.id, minutes: 60 },
    ] })).data;
    expect((await api.get(`/contributors/${first.id}/usage`)).data).toEqual({ count: 1 });
    expect((await api.delete(`/contributors/${first.id}`)).status).toBe(204);
    expect((await api.get<Activity>(`/activities/${activity.id}`)).data.contributions).toEqual([{ contributorId: second.id, minutes: 60 }]);
    expect((await api.get('/stats/overview', { params: { from: activity.date, to: activity.date } })).data.contributions).toEqual([expect.objectContaining({ contributorId: second.id })]);
    await expect(api.get(`/contributors/${first.id}/usage`)).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('rejects duplicate names even when archived and validates contributor fields', async () => {
    const person = (await api.post<Contributor>('/contributors', { name: 'Alex' })).data;
    await api.patch(`/contributors/${person.id}`, { active: false });
    await expect(api.post('/contributors', { name: ' alex ' })).rejects.toMatchObject({ response: { status: 409 } });
    for (const data of [{ name: '' }, { name: 'x'.repeat(121) }, { name: 'New', color: 'invalid' }]) {
      await expect(api.post('/contributors', data)).rejects.toMatchObject({ response: { status: 400 } });
    }
    await expect(api.patch(`/contributors/${person.id}`, { active: 'false' })).rejects.toMatchObject({ response: { status: 400 } });
    await expect(api.patch('/contributors/missing', { name: 'New' })).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('rejects invalid activity contributions without losing the stored entries', async () => {
    const person = (await api.post<Contributor>('/contributors', { name: 'Alex' })).data;
    const contributions = [{ contributorId: person.id, minutes: 45 }];
    const activity = (await api.post<Activity>('/activities', { date: '2001-01-15', durationMinutes: 60, contributions })).data;
    for (const data of [
      { contributions: [{ contributorId: person.id, minutes: 61 }] },
      { contributions: [{ contributorId: person.id, minutes: 0 }] },
      { contributions: [...contributions, ...contributions] },
      { contributions: [{ contributorId: 'missing', minutes: 20 }] },
      { executionStatus: 'cancelled' },
    ]) {
      await expect(api.patch(`/activities/${activity.id}`, data)).rejects.toMatchObject({ response: { status: 400 } });
      expect((await api.get<Activity>(`/activities/${activity.id}`)).data.contributions).toEqual(contributions);
    }
    await api.patch(`/contributors/${person.id}`, { active: false });
    await api.patch(`/activities/${activity.id}`, { title: 'Historical' });
    await expect(api.post('/activities', { date: '2001-01-16', durationMinutes: 60, contributions })).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('provides seeded contribution examples and resets session edits', async () => {
    const initial = (await api.get('/contributors')).data;
    expect((await api.get('/stats/overview')).data.contributions.length).toBeGreaterThan(0);
    await api.post('/contributors', { name: 'Temporary' });
    resetDemoStore();
    expect((await api.get('/contributors')).data).toEqual(initial);
  });
});
