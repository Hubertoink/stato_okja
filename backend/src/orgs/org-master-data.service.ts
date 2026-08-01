import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { parseDocument, stringify } from 'yaml';
import { Organization } from './entities/organization.entity';
import { Category } from '../taxonomy/entities/category.entity';
import { Tag } from '../taxonomy/entities/tag.entity';
import { Cohort } from '../taxonomy/entities/cohort.entity';
import { Location } from '../locations/entities/location.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { AuditAction } from '../common/enums';
import { OrgsService } from './orgs.service';

const FORMAT = 'stato-master-data';
const SCHEMA_VERSION = 1;
const MAX_CONTENT_BYTES = 1_000_000;
const MAX_ITEMS_PER_SECTION = 500;
const MAX_NAME_LENGTH = 160;
const MAX_TEXT_LENGTH = 5_000;
const MAX_SYNONYMS = 50;
const COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

type MasterDataKind = 'categories' | 'tags' | 'cohorts' | 'locations';
type ImportActor = { id?: string; name?: string | null; orgId?: string | null };

type ImportedCategory = {
  name: string;
  description?: string | null;
  standardRef?: string | null;
  color?: string | null;
  active: boolean;
};

type ImportedTag = {
  name: string;
  synonyms?: string[] | null;
  description?: string | null;
  color?: string | null;
  active: boolean;
};

type ImportedCohort = {
  name: string;
  minAge: number;
  maxAge: number;
  sortOrder: number;
  active: boolean;
  inheritToChildren: boolean;
};

type ImportedLocation = {
  name: string;
  address?: string | null;
  roomType?: string | null;
  description?: string | null;
  active: boolean;
};

type MasterDataDocument = {
  metadata?: { sourceOrganization?: string; exportedAt?: string };
  categories: ImportedCategory[];
  tags: ImportedTag[];
  cohorts: ImportedCohort[];
  locations: ImportedLocation[];
};

export type OrgMasterDataPreview = {
  valid: boolean;
  sourceOrganization: string | null;
  counts: Record<MasterDataKind, { total: number; create: number; existing: number }>;
  errors: string[];
  warnings: string[];
};

type ParsedMasterData = { document: MasterDataDocument; errors: string[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizedName(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
}

function unwrapYamlCodeFence(content: string) {
  const match = content.trim().match(/^```(?:yaml|yml)?\s*\r?\n([\s\S]*?)\r?\n```$/i);
  return match ? match[1] : content;
}

function nullableText(
  value: unknown,
  path: string,
  errors: string[],
  maxLength = MAX_TEXT_LENGTH,
): string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    errors.push(`${path} muss ein Text sein.`);
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    errors.push(`${path} darf maximal ${maxLength} Zeichen enthalten.`);
    return undefined;
  }
  return trimmed || null;
}

function requiredName(value: unknown, path: string, errors: string[]): string {
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`${path} ist erforderlich.`);
    return '';
  }
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length > MAX_NAME_LENGTH) {
    errors.push(`${path} darf maximal ${MAX_NAME_LENGTH} Zeichen enthalten.`);
    return '';
  }
  return name;
}

function optionalBoolean(value: unknown, path: string, errors: string[], fallback: boolean) {
  if (typeof value === 'undefined') return fallback;
  if (typeof value !== 'boolean') {
    errors.push(`${path} muss wahr oder falsch sein.`);
    return fallback;
  }
  return value;
}

function optionalInteger(
  value: unknown,
  path: string,
  errors: string[],
  fallback: number,
  min: number,
  max: number,
) {
  if (typeof value === 'undefined') return fallback;
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    errors.push(`${path} muss eine ganze Zahl zwischen ${min} und ${max} sein.`);
    return fallback;
  }
  return value as number;
}

@Injectable()
export class OrgMasterDataService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Organization) private readonly organizations: Repository<Organization>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Tag) private readonly tags: Repository<Tag>,
    @InjectRepository(Cohort) private readonly cohorts: Repository<Cohort>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    @InjectRepository(AuditLog) private readonly auditLogs: Repository<AuditLog>,
    private readonly orgs: OrgsService,
  ) {}

  static template() {
    return stringify(
      {
        format: FORMAT,
        schemaVersion: SCHEMA_VERSION,
        metadata: { sourceOrganization: 'Name der Organisation' },
        categories: [
          {
            name: 'Beratung',
            description: 'Beratungsangebote',
            standardRef: '§ 11 SGB VIII',
            color: '#2563EB',
          },
        ],
        tags: [
          {
            name: 'Ferienangebot',
            synonyms: ['Ferienprogramm'],
            description: 'Angebote in den Schulferien',
            color: '#F59E0B',
          },
        ],
        cohorts: [{ name: 'Kinder', minAge: 6, maxAge: 12, sortOrder: 10 }],
        locations: [
          {
            name: 'Jugendhaus',
            address: 'Musterstraße 1',
            roomType: 'Offener Bereich',
            description: 'Hauptstandort',
          },
        ],
      },
      { lineWidth: 0 },
    );
  }

  async export(orgId: string, actor: ImportActor) {
    const org = await this.organizations.findOne({ where: { id: orgId } });
    if (!org) throw new BadRequestException('Organisation wurde nicht gefunden.');

    const [categories, tags, cohorts, locations] = await Promise.all([
      this.categories.find({ where: { orgId }, order: { name: 'ASC' } }),
      this.tags.find({ where: { orgId }, order: { name: 'ASC' } }),
      this.cohorts.find({ where: { orgId }, order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.locations.find({ where: { orgId }, order: { name: 'ASC' } }),
    ]);

    const content = stringify(
      {
        format: FORMAT,
        schemaVersion: SCHEMA_VERSION,
        metadata: { sourceOrganization: org.name, exportedAt: new Date().toISOString() },
        categories: categories.map((item) => ({
          name: item.name,
          description: item.description || undefined,
          standardRef: item.standardRef || undefined,
          color: item.color || undefined,
          active: item.active,
        })),
        tags: tags.map((item) => ({
          name: item.name,
          synonyms: item.synonyms?.filter(Boolean) || undefined,
          description: item.description || undefined,
          color: item.color || undefined,
          active: item.active,
        })),
        cohorts: cohorts.map((item) => ({
          name: item.name,
          minAge: item.minAge,
          maxAge: item.maxAge,
          sortOrder: item.sortOrder,
          active: item.active,
          inheritToChildren: item.inheritToChildren,
        })),
        locations: locations.map((item) => ({
          name: item.name,
          address: item.address || undefined,
          roomType: item.roomType || undefined,
          description: item.description || undefined,
          active: item.active,
        })),
      },
      { lineWidth: 0 },
    );

    await this.auditLogs.save(
      this.auditLogs.create({
        action: AuditAction.EXPORT,
        entityType: 'master-data',
        entityId: orgId,
        entityTitle: org.name,
        userId: actor.id ?? null,
        userName: actor.name ?? null,
        orgId,
        details: {
          categories: categories.length,
          tags: tags.length,
          cohorts: cohorts.length,
          locations: locations.length,
        },
      }),
    );

    return { content, filename: `stato-stammdaten-${this.toFileSlug(org.name)}.yaml` };
  }

  async preview(orgId: string, content: string): Promise<OrgMasterDataPreview> {
    const parsed = this.parse(content);
    const errors = [...parsed.errors];
    const document = parsed.document;
    const [categories, tags, cohorts, locations] = await Promise.all([
      this.categories.find({ where: { orgId }, select: { name: true } }),
      this.tags.find({ where: { orgId }, select: { name: true } }),
      this.cohorts.find({ where: { orgId }, select: { name: true } }),
      this.locations.find({ where: { orgId }, select: { name: true } }),
    ]);

    const existingByKind: Record<MasterDataKind, Set<string>> = {
      categories: new Set(categories.map((item) => normalizedName(item.name))),
      tags: new Set(tags.map((item) => normalizedName(item.name))),
      cohorts: new Set(cohorts.map((item) => normalizedName(item.name))),
      locations: new Set(locations.map((item) => normalizedName(item.name))),
    };
    const recordsByKind: Record<MasterDataKind, Array<{ name: string }>> = {
      categories: document.categories,
      tags: document.tags,
      cohorts: document.cohorts,
      locations: document.locations,
    };
    const counts = {} as OrgMasterDataPreview['counts'];

    for (const kind of Object.keys(recordsByKind) as MasterDataKind[]) {
      const seen = new Set<string>();
      let create = 0;
      let existing = 0;
      recordsByKind[kind].forEach((item, index) => {
        const key = normalizedName(item.name);
        if (seen.has(key)) {
          errors.push(
            `${this.sectionLabel(kind)}: „${item.name}“ ist in der Datei mehrfach vorhanden (Eintrag ${index + 1}).`,
          );
          return;
        }
        seen.add(key);
        if (existingByKind[kind].has(key)) existing += 1;
        else create += 1;
      });
      counts[kind] = { total: recordsByKind[kind].length, create, existing };
    }

    if (
      document.categories.length &&
      !(await this.orgs.canCreateOwnTaxonomy(orgId, 'categories'))
    ) {
      errors.push('Für diese Organisation sind lokale Kategorien gesperrt.');
    }
    if (document.tags.length && !(await this.orgs.canCreateOwnTaxonomy(orgId, 'tags'))) {
      errors.push('Für diese Organisation sind lokale Tags gesperrt.');
    }
    if (document.cohorts.length && !(await this.orgs.canCreateOwnTaxonomy(orgId, 'cohorts'))) {
      errors.push('Für diese Organisation sind lokale Kohorten gesperrt.');
    }

    const warnings: string[] = [];
    const existingTotal = Object.values(counts).reduce((sum, count) => sum + count.existing, 0);
    if (existingTotal)
      warnings.push(`${existingTotal} bereits vorhandene Einträge werden übersprungen.`);
    if (Object.values(counts).every((count) => count.total === 0)) {
      errors.push('Die Datei enthält keine Kategorien, Tags, Kohorten oder Einrichtungen.');
    }

    return {
      valid: errors.length === 0,
      sourceOrganization: document.metadata?.sourceOrganization || null,
      counts,
      errors,
      warnings,
    };
  }

  async import(orgId: string, content: string, actor: ImportActor) {
    const preview = await this.preview(orgId, content);
    if (!preview.valid) throw new BadRequestException(preview.errors);
    const document = this.parse(content).document;
    const org = await this.organizations.findOne({ where: { id: orgId } });
    if (!org) throw new BadRequestException('Organisation wurde nicht gefunden.');

    const result = await this.dataSource.transaction(async (manager) => {
      const categoryRepo = manager.getRepository(Category);
      const tagRepo = manager.getRepository(Tag);
      const cohortRepo = manager.getRepository(Cohort);
      const locationRepo = manager.getRepository(Location);
      const existingByKind: Record<MasterDataKind, Set<string>> = {
        categories: new Set(
          (await categoryRepo.find({ where: { orgId }, select: { name: true } })).map((item) =>
            normalizedName(item.name),
          ),
        ),
        tags: new Set(
          (await tagRepo.find({ where: { orgId }, select: { name: true } })).map((item) =>
            normalizedName(item.name),
          ),
        ),
        cohorts: new Set(
          (await cohortRepo.find({ where: { orgId }, select: { name: true } })).map((item) =>
            normalizedName(item.name),
          ),
        ),
        locations: new Set(
          (await locationRepo.find({ where: { orgId }, select: { name: true } })).map((item) =>
            normalizedName(item.name),
          ),
        ),
      };

      const newCategories = document.categories.filter(
        (item) => !existingByKind.categories.has(normalizedName(item.name)),
      );
      const newTags = document.tags.filter(
        (item) => !existingByKind.tags.has(normalizedName(item.name)),
      );
      const newCohorts = document.cohorts.filter(
        (item) => !existingByKind.cohorts.has(normalizedName(item.name)),
      );
      const newLocations = document.locations.filter(
        (item) => !existingByKind.locations.has(normalizedName(item.name)),
      );

      if (newCategories.length)
        await categoryRepo.save(
          newCategories.map((item) =>
            categoryRepo.create({
              name: item.name,
              description: item.description ?? undefined,
              standardRef: item.standardRef ?? undefined,
              color: item.color ?? undefined,
              active: item.active,
              orgId,
            }),
          ),
        );
      if (newTags.length)
        await tagRepo.save(
          newTags.map((item) =>
            tagRepo.create({
              name: item.name,
              synonyms: item.synonyms ?? undefined,
              description: item.description ?? undefined,
              color: item.color ?? undefined,
              active: item.active,
              orgId,
            }),
          ),
        );
      if (newCohorts.length)
        await cohortRepo.save(newCohorts.map((item) => cohortRepo.create({ ...item, orgId })));
      if (newLocations.length)
        await locationRepo.save(
          newLocations.map((item) =>
            locationRepo.create({
              name: item.name,
              address: item.address ?? undefined,
              roomType: item.roomType ?? undefined,
              description: item.description ?? undefined,
              active: item.active,
              orgId,
            }),
          ),
        );

      const created = {
        categories: newCategories.length,
        tags: newTags.length,
        cohorts: newCohorts.length,
        locations: newLocations.length,
      };
      await manager.getRepository(AuditLog).save(
        manager.getRepository(AuditLog).create({
          action: AuditAction.CREATE,
          entityType: 'master-data-import',
          entityId: orgId,
          entityTitle: org.name,
          userId: actor.id ?? null,
          userName: actor.name ?? null,
          orgId,
          details: {
            created,
            skipped: {
              categories: preview.counts.categories.existing,
              tags: preview.counts.tags.existing,
              cohorts: preview.counts.cohorts.existing,
              locations: preview.counts.locations.existing,
            },
          },
        }),
      );
      return created;
    });

    return {
      created: result,
      skipped: {
        categories: preview.counts.categories.existing,
        tags: preview.counts.tags.existing,
        cohorts: preview.counts.cohorts.existing,
        locations: preview.counts.locations.existing,
      },
    };
  }

  private parse(content: string): ParsedMasterData {
    const errors: string[] = [];
    if (typeof content !== 'string' || !content.trim()) {
      return {
        document: this.emptyDocument(),
        errors: ['Bitte füge eine YAML-Datei ein oder wähle eine Datei aus.'],
      };
    }
    const yamlContent = unwrapYamlCodeFence(content);
    if (Buffer.byteLength(yamlContent, 'utf8') > MAX_CONTENT_BYTES) {
      return { document: this.emptyDocument(), errors: ['Die Datei ist größer als 1 MB.'] };
    }

    let raw: unknown;
    try {
      const yaml = parseDocument(yamlContent, { uniqueKeys: true, prettyErrors: false });
      if (yaml.errors.length) {
        return {
          document: this.emptyDocument(),
          errors: yaml.errors.map((error) => `Ungültiges YAML: ${error.message}`),
        };
      }
      raw = yaml.toJS({ maxAliasCount: 0 });
    } catch (error) {
      return {
        document: this.emptyDocument(),
        errors: [
          `Ungültiges YAML: ${error instanceof Error ? error.message : 'unbekannter Fehler'}`,
        ],
      };
    }
    if (!isPlainObject(raw))
      return {
        document: this.emptyDocument(),
        errors: ['Die YAML-Datei muss ein Objekt enthalten.'],
      };
    if (raw.format !== FORMAT) errors.push(`format muss „${FORMAT}“ sein.`);
    if (raw.schemaVersion !== SCHEMA_VERSION)
      errors.push(`schemaVersion muss ${SCHEMA_VERSION} sein.`);

    const metadata = this.parseMetadata(raw.metadata, errors);
    return {
      document: {
        metadata,
        categories: this.parseCategories(raw.categories, errors),
        tags: this.parseTags(raw.tags, errors),
        cohorts: this.parseCohorts(raw.cohorts, errors),
        locations: this.parseLocations(raw.locations, errors),
      },
      errors,
    };
  }

  private parseMetadata(value: unknown, errors: string[]) {
    if (typeof value === 'undefined') return undefined;
    if (!isPlainObject(value)) {
      errors.push('metadata muss ein Objekt sein.');
      return undefined;
    }
    const sourceOrganization = nullableText(
      value.sourceOrganization,
      'metadata.sourceOrganization',
      errors,
      MAX_NAME_LENGTH,
    );
    const exportedAt = nullableText(value.exportedAt, 'metadata.exportedAt', errors, 100);
    return {
      ...(typeof sourceOrganization === 'string' ? { sourceOrganization } : {}),
      ...(typeof exportedAt === 'string' ? { exportedAt } : {}),
    };
  }

  private parseArray(value: unknown, path: string, errors: string[]) {
    if (typeof value === 'undefined') return [];
    if (!Array.isArray(value)) {
      errors.push(`${path} muss eine Liste sein.`);
      return [];
    }
    if (value.length > MAX_ITEMS_PER_SECTION)
      errors.push(`${path} darf maximal ${MAX_ITEMS_PER_SECTION} Einträge enthalten.`);
    return value.slice(0, MAX_ITEMS_PER_SECTION);
  }

  private parseCategories(value: unknown, errors: string[]): ImportedCategory[] {
    return this.parseArray(value, 'categories', errors).flatMap((raw, index) => {
      const path = `categories[${index + 1}]`;
      if (!isPlainObject(raw)) {
        errors.push(`${path} muss ein Objekt sein.`);
        return [];
      }
      const name = requiredName(raw.name, `${path}.name`, errors);
      const description = nullableText(raw.description, `${path}.description`, errors);
      const standardRef = nullableText(raw.standardRef, `${path}.standardRef`, errors);
      const color = nullableText(raw.color, `${path}.color`, errors, 20);
      if (color && !COLOR_RE.test(color))
        errors.push(`${path}.color muss ein hexadezimaler Farbwert sein.`);
      return name
        ? [
            {
              name,
              description,
              standardRef,
              color,
              active: optionalBoolean(raw.active, `${path}.active`, errors, true),
            },
          ]
        : [];
    });
  }

  private parseTags(value: unknown, errors: string[]): ImportedTag[] {
    return this.parseArray(value, 'tags', errors).flatMap((raw, index) => {
      const path = `tags[${index + 1}]`;
      if (!isPlainObject(raw)) {
        errors.push(`${path} muss ein Objekt sein.`);
        return [];
      }
      const name = requiredName(raw.name, `${path}.name`, errors);
      const description = nullableText(raw.description, `${path}.description`, errors);
      const color = nullableText(raw.color, `${path}.color`, errors, 20);
      if (color && !COLOR_RE.test(color))
        errors.push(`${path}.color muss ein hexadezimaler Farbwert sein.`);
      let synonyms: string[] | undefined;
      if (typeof raw.synonyms !== 'undefined') {
        if (!Array.isArray(raw.synonyms) || raw.synonyms.length > MAX_SYNONYMS)
          errors.push(`${path}.synonyms muss eine Liste mit maximal ${MAX_SYNONYMS} Texten sein.`);
        else
          synonyms = Array.from(
            new Set(
              raw.synonyms
                .map((item, synonymIndex) =>
                  requiredName(item, `${path}.synonyms[${synonymIndex + 1}]`, errors),
                )
                .filter(Boolean),
            ),
          );
      }
      return name
        ? [
            {
              name,
              description,
              color,
              synonyms,
              active: optionalBoolean(raw.active, `${path}.active`, errors, true),
            },
          ]
        : [];
    });
  }

  private parseCohorts(value: unknown, errors: string[]): ImportedCohort[] {
    return this.parseArray(value, 'cohorts', errors).flatMap((raw, index) => {
      const path = `cohorts[${index + 1}]`;
      if (!isPlainObject(raw)) {
        errors.push(`${path} muss ein Objekt sein.`);
        return [];
      }
      const name = requiredName(raw.name, `${path}.name`, errors);
      const minAge = optionalInteger(raw.minAge, `${path}.minAge`, errors, -1, 0, 130);
      const maxAge = optionalInteger(raw.maxAge, `${path}.maxAge`, errors, -1, 0, 130);
      if (minAge < 0) errors.push(`${path}.minAge ist erforderlich.`);
      if (maxAge < 0) errors.push(`${path}.maxAge ist erforderlich.`);
      if (minAge >= 0 && maxAge >= 0 && minAge > maxAge)
        errors.push(`${path}: minAge darf nicht größer als maxAge sein.`);
      return name && minAge >= 0 && maxAge >= 0 && minAge <= maxAge
        ? [
            {
              name,
              minAge,
              maxAge,
              sortOrder: optionalInteger(
                raw.sortOrder,
                `${path}.sortOrder`,
                errors,
                0,
                -10_000,
                10_000,
              ),
              active: optionalBoolean(raw.active, `${path}.active`, errors, true),
              inheritToChildren: optionalBoolean(
                raw.inheritToChildren,
                `${path}.inheritToChildren`,
                errors,
                false,
              ),
            },
          ]
        : [];
    });
  }

  private parseLocations(value: unknown, errors: string[]): ImportedLocation[] {
    return this.parseArray(value, 'locations', errors).flatMap((raw, index) => {
      const path = `locations[${index + 1}]`;
      if (!isPlainObject(raw)) {
        errors.push(`${path} muss ein Objekt sein.`);
        return [];
      }
      const name = requiredName(raw.name, `${path}.name`, errors);
      return name
        ? [
            {
              name,
              address: nullableText(raw.address, `${path}.address`, errors),
              roomType: nullableText(raw.roomType, `${path}.roomType`, errors, MAX_NAME_LENGTH),
              description: nullableText(raw.description, `${path}.description`, errors),
              active: optionalBoolean(raw.active, `${path}.active`, errors, true),
            },
          ]
        : [];
    });
  }

  private emptyDocument(): MasterDataDocument {
    return { categories: [], tags: [], cohorts: [], locations: [] };
  }

  private sectionLabel(kind: MasterDataKind) {
    return (
      {
        categories: 'Kategorien',
        tags: 'Tags',
        cohorts: 'Kohorten',
        locations: 'Einrichtungen',
      } as const
    )[kind];
  }

  private toFileSlug(name: string) {
    const slug = name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || 'organisation';
  }
}
