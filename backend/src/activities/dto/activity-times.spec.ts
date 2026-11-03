import { validate } from 'class-validator';
import { CreateActivityDto, UpdateActivityDto } from './activity.dto';
import { ActivityType } from '../../common/enums';

describe('activity time requirements', () => {
  it.each([undefined, null, '', '25:00'])('rejects missing or invalid times on creation: %s', async (time) => {
    const dto = Object.assign(new CreateActivityDto(), { date: '2026-11-03', type: ActivityType.EVENT, startTime: time, endTime: time });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['startTime', 'endTime']));
  });

  it('accepts explicit times and partial updates without changing existing times', async () => {
    expect(await validate(Object.assign(new CreateActivityDto(), { date: '2026-11-03', type: ActivityType.EVENT, startTime: '09:30', endTime: '11:45' }))).toEqual([]);
    expect(await validate(Object.assign(new UpdateActivityDto(), { title: 'Geändert', notes: null }))).toEqual([]);
  });

  it.each([null, ''])('does not allow clearing a time on update: %s', async (time) => {
    const errors = await validate(Object.assign(new UpdateActivityDto(), { startTime: time, endTime: time }));
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['startTime', 'endTime']));
  });
});
