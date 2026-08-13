import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLogbookEntryDto } from '../logbook/dto/logbook.dto';
import { UpdateOpeningHoursDto } from '../orgs/dto/organization.dto';
import { CreateCohortDto, CreateTagDto } from '../taxonomy/dto/taxonomy.dto';

async function validationErrors(dto: object) {
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

describe('write DTO validation', () => {
  it('rejects unknown taxonomy fields and invalid cohort ages', async () => {
    await expect(
      validationErrors(plainToInstance(CreateTagDto, { name: 'Ferien', injected: true })),
    ).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ property: 'injected' })]));

    await expect(
      validationErrors(plainToInstance(CreateCohortDto, { name: '12–14', minAge: -1, maxAge: 14 })),
    ).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ property: 'minAge' })]));
  });

  it('requires a valid timestamp and content for logbook entries', async () => {
    await expect(
      validationErrors(plainToInstance(CreateLogbookEntryDto, {
        occurredAt: 'not-a-date', title: '', body: 'Eintrag', activityId: 'not-a-uuid',
      })),
    ).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'occurredAt' }),
      expect.objectContaining({ property: 'activityId' }),
    ]));
  });

  it('validates every opening-hours day as a nested DTO', async () => {
    await expect(
      validationErrors(plainToInstance(UpdateOpeningHoursDto, {
        monday: { open: true }, tuesday: { open: true }, wednesday: { open: true },
        thursday: { open: true }, friday: { open: true }, saturday: { open: true },
        sunday: { open: 'yes' },
      })),
    ).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ property: 'sunday' })]));
  });
});
