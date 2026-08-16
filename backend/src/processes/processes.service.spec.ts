import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { isProcessesFeatureEnabled, ProcessesService } from './processes.service';
import type { ProcessDefinition } from './entities/process.entity';

const definition = (overrides: Partial<ProcessDefinition> = {}): ProcessDefinition => ({
  schemaVersion: 1,
  nodes: [
    {
      id: 'node-1',
      type: 'input',
      position: { x: 0, y: 0 },
      data: { label: 'Anlass' },
    },
  ],
  edges: [],
  ...overrides,
});

describe('ProcessesService', () => {
  const repository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const orgs = { isProcessesEnabled: jest.fn() };
  const audit = { log: jest.fn() };
  const service = new ProcessesService(repository as never, orgs as never, audit as never);
  const editor = { id: 'editor-1', name: 'Editor', role: 'editor', orgId: 'org-1', effectiveOrgId: 'org-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    orgs.isProcessesEnabled.mockResolvedValue(true);
  });

  it('does not expose a disabled process workspace', async () => {
    orgs.isProcessesEnabled.mockResolvedValue(false);

    await expect(service.list(editor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.find).not.toHaveBeenCalled();
  });

  it('honours the global container switch before organisation settings', async () => {
    expect(isProcessesFeatureEnabled('false')).toBe(false);
    expect(isProcessesFeatureEnabled('0')).toBe(false);
    expect(isProcessesFeatureEnabled('true')).toBe(true);

    const previous = process.env.ENABLE_PROCESSES;
    process.env.ENABLE_PROCESSES = 'false';
    try {
      await expect(service.access(editor)).resolves.toEqual({ enabled: false, canEdit: false, orgId: 'org-1' });
      expect(orgs.isProcessesEnabled).not.toHaveBeenCalled();
    } finally {
      if (typeof previous === 'undefined') delete process.env.ENABLE_PROCESSES;
      else process.env.ENABLE_PROCESSES = previous;
    }
  });

  it('keeps read-only users from creating process definitions', async () => {
    await expect(service.create({ title: 'Testprozess' }, { ...editor, role: 'user' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects edges that do not connect two known nodes', async () => {
    const invalid = definition({
      edges: [{ id: 'edge-1', source: 'node-1', target: 'missing-node' }],
    });

    await expect(service.create({ title: 'Testprozess', definition: invalid }, editor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a valid process in the active organization', async () => {
    const created = { id: 'process-1', title: 'Testprozess', orgId: 'org-1', definition: definition() };
    repository.save.mockResolvedValue(created);

    await expect(service.create({ title: ' Testprozess ', definition: definition() }, editor)).resolves.toEqual(created);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'org-1',
      title: 'Testprozess',
      createdByUserId: 'editor-1',
    }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'process', orgId: 'org-1' }));
  });
});
