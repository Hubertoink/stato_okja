import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ActivityType, AuditAction } from '../common/enums';

describe('ProjectsService idempotent create', () => {
  function createService(
    projectRepository: Record<string, unknown>,
    scopeOrgIds: Record<string, string[]> = {},
  ) {
    return new ProjectsService(
      projectRepository as never,
      {} as never,
      {} as never,
      {
        getResolvedOrgScope: jest.fn(async (orgId: string | null) =>
          orgId === null ? { orgId: null } : { orgId, orgIds: scopeOrgIds[orgId] || [orgId] },
        ),
      } as never,
      { log: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
    );
  }

  it('returns an existing project for the same clientRequestId without creating a second one', async () => {
    const existingProject = {
      id: 'project-1',
      title: 'Werkraum',
      type: ActivityType.PROJECT_OPEN,
      orgId: 'org-1',
      clientRequestId: 'req-1',
      imageUrl: null,
    };
    const projectRepository = {
      findOne: jest.fn().mockResolvedValue(existingProject),
      create: jest.fn(),
      save: jest.fn(),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new ProjectsService(
      projectRepository as never,
      {} as never,
      {} as never,
      {} as never,
      audit as never,
      {} as never,
    );

    const result = await service.create(
      {
        title: 'Werkraum',
        type: ActivityType.PROJECT_OPEN,
        orgId: 'org-1',
        clientRequestId: 'req-1',
      },
      { id: 'user-1', name: 'Niko', orgId: 'org-1' },
    );

    expect(projectRepository.create).not.toHaveBeenCalled();
    expect(projectRepository.save).not.toHaveBeenCalled();
    expect(projectRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientRequestId: 'req-1', orgId: expect.anything() }),
      }),
    );
    expect(audit.log).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.CREATE }),
    );
    expect(result).toEqual(existingProject);
  });

  it('returns the already created project when a duplicate clientRequestId hits the unique index', async () => {
    const savedProject = {
      id: 'project-2',
      title: 'Atelier',
      type: ActivityType.PROJECT_OPEN,
      orgId: 'org-1',
      clientRequestId: 'req-2',
      imageUrl: null,
    };
    const uniqueViolation = { code: '23505' };
    const projectRepository = {
      findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(savedProject),
      create: jest.fn((data) => data),
      save: jest.fn().mockRejectedValue(uniqueViolation),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new ProjectsService(
      projectRepository as never,
      {} as never,
      {} as never,
      {} as never,
      audit as never,
      {} as never,
    );

    const result = await service.create(
      {
        title: 'Atelier',
        type: ActivityType.PROJECT_OPEN,
        orgId: 'org-1',
        clientRequestId: 'req-2',
      },
      { id: 'user-1', name: 'Niko', orgId: 'org-1' },
    );

    expect(projectRepository.create).toHaveBeenCalled();
    expect(projectRepository.save).toHaveBeenCalledTimes(1);
    expect(audit.log).not.toHaveBeenCalled();
    expect(result).toEqual(savedProject);
  });

  it('rejects direct updates outside the effective project org scope', async () => {
    const projectRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'project-1', orgId: 'child-1' }),
      update: jest.fn(),
    };
    const service = createService(projectRepository);

    await expect(
      service.updateScoped(
        'project-1',
        { title: 'Parent edit' },
        { role: 'superadmin', orgId: null, effectiveOrgId: 'outside-1' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(projectRepository.update).not.toHaveBeenCalled();
  });

  it('allows direct updates in a descendant of the effective project scope', async () => {
    const projectRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'project-1', orgId: 'child-1' })
        .mockResolvedValueOnce({
          id: 'project-1',
          title: 'Child edit',
          orgId: 'child-1',
          imageUrl: null,
        }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const service = createService(projectRepository, { 'parent-1': ['parent-1', 'child-1'] });

    const result = await service.updateScoped(
      'project-1',
      { title: 'Child edit' },
      { role: 'superadmin', orgId: null, effectiveOrgId: 'parent-1' },
    );

    expect(projectRepository.update).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({ title: 'Child edit' }),
    );
    expect(result).toMatchObject({ id: 'project-1', orgId: 'child-1' });
  });

  it('lists only projects from the selected organization, not its children', async () => {
    const projectRepository = { find: jest.fn().mockResolvedValue([]) };
    const service = createService(projectRepository, { 'parent-1': ['parent-1', 'child-1'] });

    await service.findAllScoped(undefined, undefined, {
      role: 'superadmin',
      orgId: null,
      effectiveOrgId: 'parent-1',
    });

    expect(projectRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ orgId: expect.anything() }) }),
    );
    const where = (
      projectRepository.find.mock.calls[0][0] as { where: { orgId: { value?: unknown } } }
    ).where;
    expect(where.orgId.value).toBe('parent-1');
  });

  it('requires archived projects without activities before permanent deletion', async () => {
    const projectRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'project-1', archived: true, documents: [] }),
      delete: jest.fn(),
    };
    const activityRepository = { count: jest.fn().mockResolvedValue(2) };
    const service = new ProjectsService(
      projectRepository as never,
      {} as never,
      {} as never,
      {} as never,
      { log: jest.fn() } as never,
      activityRepository as never,
    );

    await expect(service.remove('project-1')).rejects.toBeInstanceOf(ConflictException);
    expect(projectRepository.delete).not.toHaveBeenCalled();
  });

  it('deletes an archived project only after confirming no activities reference it', async () => {
    const projectRepository = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'project-1', title: 'Werkraum', archived: true, documents: [] }),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const activityRepository = { count: jest.fn().mockResolvedValue(0) };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new ProjectsService(
      projectRepository as never,
      {} as never,
      {} as never,
      {} as never,
      audit as never,
      activityRepository as never,
    );

    await service.remove('project-1');
    expect(activityRepository.count).toHaveBeenCalledWith({ where: { projectId: 'project-1' } });
    expect(projectRepository.delete).toHaveBeenCalledWith('project-1');
  });
});
