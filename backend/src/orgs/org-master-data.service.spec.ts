import { BadRequestException } from '@nestjs/common';
import { OrgMasterDataService } from './org-master-data.service';

function createService(options?: {
  locks?: Partial<Record<'categories' | 'tags' | 'cohorts', boolean>>;
}) {
  const repository = (items: Array<{ name: string }> = []) => ({
    find: jest.fn().mockResolvedValue(items),
    create: jest.fn((value) => value),
    save: jest.fn(),
  });
  const categories = repository([{ name: 'Beratung' }]);
  const tags = repository();
  const cohorts = repository();
  const locations = repository();
  const organizations = {
    findOne: jest.fn().mockResolvedValue({ id: 'org-1', name: 'Jugendhaus' }),
  };
  const auditLogs = { create: jest.fn((value) => value), save: jest.fn() };
  const orgs = {
    canCreateOwnTaxonomy: jest.fn(
      async (_orgId: string, kind: 'categories' | 'tags' | 'cohorts') =>
        options?.locks?.[kind] !== false,
    ),
  };
  const dataSource = { transaction: jest.fn() };
  const service = new OrgMasterDataService(
    dataSource as never,
    organizations as never,
    categories as never,
    tags as never,
    cohorts as never,
    locations as never,
    auditLogs as never,
    orgs as never,
  );
  return { service };
}

const yaml = `
format: stato-master-data
schemaVersion: 1
metadata:
  sourceOrganization: Vorlage
categories:
  - name: Beratung
  - name: Medien
tags:
  - name: Ferienangebot
    synonyms: [Ferienprogramm]
cohorts:
  - name: Kinder
    minAge: 6
    maxAge: 12
locations:
  - name: Jugendhaus
    roomType: Offener Bereich
`;

describe('OrgMasterDataService', () => {
  it('previews local master data and skips existing records', async () => {
    const { service } = createService();

    await expect(service.preview('org-1', yaml)).resolves.toMatchObject({
      valid: true,
      sourceOrganization: 'Vorlage',
      counts: {
        categories: { total: 2, create: 1, existing: 1 },
        tags: { total: 1, create: 1, existing: 0 },
        cohorts: { total: 1, create: 1, existing: 0 },
        locations: { total: 1, create: 1, existing: 0 },
      },
    });
  });

  it('marks a locked taxonomy section as blocked without blocking other sections', async () => {
    const { service } = createService({ locks: { tags: false } });

    const preview = await service.preview('org-1', yaml);
    expect(preview.valid).toBe(true);
    expect(preview.counts.tags).toEqual({ total: 1, create: 0, existing: 0, blocked: true });
    expect(preview.counts.cohorts).toEqual({ total: 1, create: 1, existing: 0, blocked: false });
  });

  it('accepts YAML copied from a fenced AI response', async () => {
    const { service } = createService();

    await expect(service.preview('org-1', `\`\`\`yaml${yaml}\`\`\``)).resolves.toMatchObject({
      valid: true,
    });
  });

  it('rejects duplicate records in a file before import', async () => {
    const { service } = createService();
    const duplicateYaml = yaml.replace(
      '    synonyms: [Ferienprogramm]',
      '    synonyms: [Ferienprogramm]\n  - name: ferienangebot',
    );

    const preview = await service.preview('org-1', duplicateYaml);
    expect(preview.valid).toBe(false);
    expect(preview.errors.some((error) => error.includes('mehrfach vorhanden'))).toBe(true);
  });

  it('rejects an import when its preview is invalid', async () => {
    const { service } = createService();

    await expect(service.import('org-1', 'format: wrong', { id: 'user-1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
