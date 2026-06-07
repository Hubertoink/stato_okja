import { ForbiddenException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ActivityType, AuditAction } from '../common/enums';

describe('ProjectsService idempotent create', () => {
  function createService(projectRepository: Record<string, unknown>) {
    return new ProjectsService(
      projectRepository as never,
      {} as never,
      {} as never,
      {} as never,
      { log: jest.fn().mockResolvedValue(undefined) } as never,
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
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(savedProject),
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
        { role: 'superadmin', orgId: null, effectiveOrgId: 'parent-1' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(projectRepository.update).not.toHaveBeenCalled();
  });

  it('allows direct updates inside the effective project org scope', async () => {
    const projectRepository = {
      findOne: jest.fn()
        .mockResolvedValueOnce({ id: 'project-1', orgId: 'child-1' })
        .mockResolvedValueOnce({ id: 'project-1', title: 'Child edit', orgId: 'child-1', imageUrl: null }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const service = createService(projectRepository);

    const result = await service.updateScoped(
      'project-1',
      { title: 'Child edit' },
      { role: 'superadmin', orgId: null, effectiveOrgId: 'child-1' },
    );

    expect(projectRepository.update).toHaveBeenCalledWith('project-1', expect.objectContaining({ title: 'Child edit' }));
    expect(result).toMatchObject({ id: 'project-1', orgId: 'child-1' });
  });
});