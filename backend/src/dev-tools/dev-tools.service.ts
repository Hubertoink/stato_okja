import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import { Activity } from '../activities/entities/activity.entity';
import { applyActivityRelationJoins } from '../activities/activity-list-query';
import { Category } from '../taxonomy/entities/category.entity';
import { Tag } from '../taxonomy/entities/tag.entity';
import { Location } from '../locations/entities/location.entity';
import { Staff } from '../staff/entities/staff.entity';
import { Cohort } from '../taxonomy/entities/cohort.entity';
import { Organization } from '../orgs/entities/organization.entity';
import { ActivityType, StaffRole } from '../common/enums';
import {
  GenerateTestDataDto,
  type TestDataPreset,
} from './dto/generate-test-data.dto';

const TESTDATA_MARKER = '[STATO_TESTDATA]';

const PRESET_CONFIG: Record<TestDataPreset, { projects: number; activities: number; monthsBack: number }> = {
  small: { projects: 8, activities: 250, monthsBack: 4 },
  realistic: { projects: 20, activities: 1200, monthsBack: 12 },
  large: { projects: 50, activities: 8000, monthsBack: 24 },
};

const CATEGORY_LIBRARY = [
  'Beratung',
  'Medienbildung',
  'Sport',
  'Musik und Tanz',
  'Ernährung und Gesundheit',
  'Natur und Umwelt',
  'Politische und gesellschaftliche Bildung',
  'Hausaufgaben- und Lernbetreuung',
  'Künstlerisches Gestalten',
  'Prävention und Soziales Lernen',
];

const TAG_LIBRARY = [
  'Ferienangebot',
  'Offener Treff',
  'Mädchen*',
  'Jungen*',
  'Kooperation Schule',
  'Outdoor',
  'Medien',
  'Beteiligung',
  'Niedrigschwellig',
  'Inklusion',
];

const LOCATION_LIBRARY = [
  { name: 'Offener Bereich', roomType: 'Offener Treff' },
  { name: 'Kreativraum', roomType: 'Werkstatt' },
  { name: 'Medienlabor', roomType: 'Medienraum' },
  { name: 'Sportfläche', roomType: 'Sporthalle' },
  { name: 'Außengelände', roomType: 'Outdoor' },
];

const COHORT_LIBRARY = [
  { name: '6-9 Jahre', minAge: 6, maxAge: 9, sortOrder: 10 },
  { name: '10-12 Jahre', minAge: 10, maxAge: 12, sortOrder: 20 },
  { name: '13-15 Jahre', minAge: 13, maxAge: 15, sortOrder: 30 },
  { name: '16-18 Jahre', minAge: 16, maxAge: 18, sortOrder: 40 },
  { name: '18-21 Jahre', minAge: 19, maxAge: 21, sortOrder: 50 },
  { name: '22-27 Jahre', minAge: 22, maxAge: 27, sortOrder: 60 },
];

const PROJECT_LIBRARY: Array<{
  title: string;
  type: ActivityType;
  targetGroup: string;
  activityField: string;
  tag: string;
  description: string;
}> = [
  {
    title: 'Medienwerkstatt',
    type: ActivityType.PROJECT_OPEN,
    targetGroup: '10-16 Jahre',
    activityField: 'Medienbildung',
    tag: 'Digital',
    description: 'Offenes Medienprojekt mit Audio, Video und kreativem Digitalbereich.',
  },
  {
    title: 'Mädchen*treff',
    type: ActivityType.PROJECT_CLOSED,
    targetGroup: '12-17 Jahre',
    activityField: 'Genderpädagogik',
    tag: 'Mädchen*',
    description: 'Geschützter Gruppenraum mit kreativen und stärkenden Formaten.',
  },
  {
    title: 'Gaming Club',
    type: ActivityType.PROJECT_OPEN,
    targetGroup: '11-18 Jahre',
    activityField: 'Medienbildung',
    tag: 'Gaming',
    description: 'Regelmäßiges Angebot rund um Games, Fairplay und digitale Jugendkultur.',
  },
  {
    title: 'Kochstudio',
    type: ActivityType.PROJECT_OPEN,
    targetGroup: '10-18 Jahre',
    activityField: 'Ernährung und Gesundheit',
    tag: 'Kochen',
    description: 'Gemeinsames Kochen, Essen und Gespräch über Ernährung im Alltag.',
  },
  {
    title: 'Sport am Nachmittag',
    type: ActivityType.PROJECT_OPEN,
    targetGroup: '10-18 Jahre',
    activityField: 'Sport',
    tag: 'Bewegung',
    description: 'Niedrigschwellige Bewegungsangebote nach Schule und Ausbildung.',
  },
  {
    title: 'Podcast-Projekt',
    type: ActivityType.PROJECT_CLOSED,
    targetGroup: '13-21 Jahre',
    activityField: 'Medienbildung',
    tag: 'Audio',
    description: 'Redaktionelles Gruppenangebot für Themen, Sprache und Öffentlichkeit.',
  },
  {
    title: 'Umwelt-AG',
    type: ActivityType.PROJECT_OPEN,
    targetGroup: '10-16 Jahre',
    activityField: 'Natur und Umwelt',
    tag: 'Nachhaltigkeit',
    description: 'Praxisnahes Angebot zu Umwelt, Stadtteil und nachhaltigem Handeln.',
  },
  {
    title: 'Ferienprogramm',
    type: ActivityType.EVENT,
    targetGroup: '8-16 Jahre',
    activityField: 'Ferienfreizeiten und -angebote',
    tag: 'Ferien',
    description: 'Ferienaktionen mit Workshops, Tagesfahrten und offenen Angeboten.',
  },
  {
    title: 'Streetwork Mobil',
    type: ActivityType.OUTREACH,
    targetGroup: '14-21 Jahre',
    activityField: 'Beratung',
    tag: 'Outreach',
    description: 'Aufsuchende Jugendarbeit an Treffpunkten im Sozialraum.',
  },
  {
    title: 'Kreativatelier',
    type: ActivityType.PROJECT_OPEN,
    targetGroup: '9-16 Jahre',
    activityField: 'Künstlerisches Gestalten',
    tag: 'Kreativ',
    description: 'Basteln, Malen und Gestalten mit offenen Themeninseln.',
  },
  {
    title: 'Hausaufgabenhilfe',
    type: ActivityType.PROJECT_OPEN,
    targetGroup: '10-15 Jahre',
    activityField: 'Hausaufgaben- und Lernbetreuung',
    tag: 'Lernen',
    description: 'Unterstützung bei Schule, Struktur und Übergängen in den Alltag.',
  },
  {
    title: 'Demokratiewerkstatt',
    type: ActivityType.PROJECT_CLOSED,
    targetGroup: '13-19 Jahre',
    activityField: 'Politische und gesellschaftliche Bildung',
    tag: 'Partizipation',
    description: 'Beteiligungsorientiertes Gruppenformat mit Themen aus Stadtteil und Politik.',
  },
];

const OPEN_DOOR_TITLES = [
  'Offener Treff',
  'Jugendcafe',
  'Freizeittreff',
  'After-School Treff',
  'Abendöffnung',
];

const EVENT_TITLES = [
  'Ferienaktion',
  'Stadtteilfest',
  'Workshop-Tag',
  'Turnier',
  'Konzertabend',
  'Aktionstag',
];

const OUTREACH_TITLES = [
  'Parkrunde',
  'Schulhofkontakt',
  'Stadtteilrunde',
  'Mobile Präsenz',
  'Bahnhofsumfeld',
];

const STAFF_NAMES = [
  'Aylin',
  'Leonie',
  'Mehmet',
  'Sofia',
  'Ali',
  'Noah',
  'Mira',
  'Luca',
  'Yasmin',
  'Paul',
];

const PROJECT_COLORS = ['#2F6FED', '#0F9D7A', '#F59E0B', '#E25B7E', '#7C5CF0', '#1F7A8C'];

@Injectable()
export class DevToolsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Activity)
    private readonly activityRepository: Repository<Activity>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    @InjectRepository(Cohort)
    private readonly cohortRepository: Repository<Cohort>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
  ) {}

  private assertEnabled() {
    const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
    const appEnv = (process.env.APP_ENV || '').toLowerCase();
    const isProd = nodeEnv === 'production' && appEnv !== 'development';
    if (isProd) {
      throw new ForbiddenException('Testdaten-Tools sind in Produktion deaktiviert.');
    }
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private pickOne<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }

  private pickMany<T>(items: T[], count: number): T[] {
    const copy = [...items];
    copy.sort(() => Math.random() - 0.5);
    return copy.slice(0, Math.min(count, copy.length));
  }

  private chooseWeighted<T>(items: Array<{ item: T; weight: number }>): T {
    const total = items.reduce((sum, entry) => sum + entry.weight, 0);
    let threshold = Math.random() * total;
    for (const entry of items) {
      threshold -= entry.weight;
      if (threshold <= 0) return entry.item;
    }
    return items[items.length - 1].item;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private dateMonthsBack(monthsBack: number): Date {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    const end = new Date();

    for (let attempts = 0; attempts < 20; attempts++) {
      const candidate = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
      const weekday = candidate.getDay();
      const keepProbability = weekday === 0 ? 0.08 : weekday === 1 ? 0.5 : weekday === 6 ? 0.2 : 1;
      if (Math.random() <= keepProbability) {
        return candidate;
      }
    }

    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }

  private buildConfig(payload: GenerateTestDataDto) {
    const preset = payload.preset || 'realistic';
    const base = PRESET_CONFIG[preset];
    return {
      preset,
      projects: payload.projects ?? base.projects,
      activities: payload.activities ?? base.activities,
      monthsBack: payload.monthsBack ?? base.monthsBack,
      clearExisting: payload.clearExisting === true,
    };
  }

  private orgShort(orgId: string): string {
    return orgId.slice(0, 6).toLowerCase();
  }

  private generatedDescription(text: string): string {
    return `${text}\n\n${TESTDATA_MARKER}`;
  }

  private buildActivityCounts(type: ActivityType, cohorts: Cohort[]) {
    const total =
      type === ActivityType.OPEN_DOOR
        ? this.randomInt(8, 34)
        : type === ActivityType.EVENT
          ? this.randomInt(20, 80)
          : type === ActivityType.OUTREACH
            ? this.randomInt(2, 12)
            : this.randomInt(5, 18);

    let male = 0;
    let female = 0;
    let diverse = 0;
    const cohortRows = cohorts.map((cohort) => ({ cohortId: cohort.id, m: 0, w: 0, d: 0 }));

    for (let i = 0; i < total; i++) {
      const gender = this.chooseWeighted([
        { item: 'm', weight: 46 },
        { item: 'w', weight: 46 },
        { item: 'd', weight: 8 },
      ] as const);
      const cohortRow = this.pickOne(cohortRows);
      if (gender === 'm') {
        male += 1;
        cohortRow.m += 1;
      } else if (gender === 'w') {
        female += 1;
        cohortRow.w += 1;
      } else {
        diverse += 1;
        cohortRow.d += 1;
      }
    }

    return {
      male,
      female,
      diverse,
      total,
      cohortRows: cohortRows.filter((row) => row.m + row.w + row.d > 0),
    };
  }

  private buildTime(type: ActivityType) {
    const startHour =
      type === ActivityType.OUTREACH
        ? this.pickOne([14, 15, 16, 17, 18])
        : type === ActivityType.EVENT
          ? this.pickOne([10, 11, 13, 14, 15, 16])
          : this.pickOne([13, 14, 15, 16]);
    const startMinute = this.pickOne([0, 15, 30, 45]);
    const duration =
      type === ActivityType.OPEN_DOOR
        ? this.pickOne([120, 150, 180, 210, 240])
        : type === ActivityType.EVENT
          ? this.pickOne([180, 240, 300, 360])
          : type === ActivityType.OUTREACH
            ? this.pickOne([60, 90, 120, 150])
            : this.pickOne([90, 120, 150, 180]);
    const end = new Date(2000, 0, 1, startHour, startMinute + duration);
    const pad = (value: number) => String(value).padStart(2, '0');
    return {
      startTime: `${pad(startHour)}:${pad(startMinute)}`,
      endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
      durationMinutes: duration,
    };
  }

  private activityNote(type: ActivityType) {
    const notesByType: Record<ActivityType, string[]> = {
      [ActivityType.OPEN_DOOR]: [
        'Viele kurze Kontakte, Tischkicker und Gespräche zum Schulalltag.',
        'Gute Auslastung nach Schulschluss, einige Erstbesucher*innen waren dabei.',
        'Niedrigschwellige Atmosphäre, mehrere Gespräche zu Ausbildung und Freizeit.',
      ],
      [ActivityType.PROJECT_OPEN]: [
        'Gruppe arbeitete selbstständig, einzelne Jugendliche übernahmen Moderation.',
        'Hohe Beteiligung und viele eigene Ideen für die nächsten Termine.',
        'Kooperatives Arbeiten, gute Mischung aus Einstieg und Vertiefung.',
      ],
      [ActivityType.PROJECT_CLOSED]: [
        'Feste Gruppe, kontinuierliche Mitarbeit und gute Verbindlichkeit.',
        'Inhaltlich vertiefter Termin mit klaren Absprachen für die nächste Woche.',
        'Ruhige Arbeitsatmosphäre und intensive Gruppengespräche.',
      ],
      [ActivityType.EVENT]: [
        'Hohe Sichtbarkeit im Haus und gute Resonanz bei Eltern und Kooperationspartnern.',
        'Veranstaltung verlief planmäßig, spontane Beteiligung war hoch.',
        'Viele Besucher*innen aus dem Sozialraum, positive Rückmeldungen zum Format.',
      ],
      [ActivityType.OUTREACH]: [
        'Mehrere Kontaktaufnahmen im Sozialraum, Gespräche über Treffpunkte und Konflikte.',
        'Aufsuchender Einsatz mit Fokus auf Beziehungspflege und Präsenz.',
        'Kurze Beratungsgespräche und Weitervermittlung an passende Angebote.',
      ],
    };
    return Math.random() > 0.35 ? this.pickOne(notesByType[type]) : null;
  }

  private async ensureCategories(orgId: string): Promise<{ items: Category[]; created: number }> {
    let items = await this.categoryRepository.find({ where: { orgId, active: true } });
    let created = 0;
    if (items.length >= 6) return { items, created };

    const missing = CATEGORY_LIBRARY.slice(0, Math.max(0, 8 - items.length));
    const additions = missing.map((name, index) =>
      this.categoryRepository.create({
        name,
        color: PROJECT_COLORS[index % PROJECT_COLORS.length],
        active: true,
        description: 'Automatisch für Testdaten angelegt.',
        orgId,
      }),
    );
    if (additions.length) {
      await this.categoryRepository.save(additions);
      created = additions.length;
      items = await this.categoryRepository.find({ where: { orgId, active: true } });
    }
    return { items, created };
  }

  private async ensureTags(orgId: string): Promise<{ items: Tag[]; created: number }> {
    let items = await this.tagRepository.find({ where: { orgId, active: true } });
    let created = 0;
    if (items.length >= 6) return { items, created };

    const short = this.orgShort(orgId);
    const missing = TAG_LIBRARY.slice(0, Math.max(0, 8 - items.length));
    const additions = missing.map((name, index) =>
      this.tagRepository.create({
        name: `${name} ${short}`,
        color: PROJECT_COLORS[(index + 1) % PROJECT_COLORS.length],
        active: true,
        description: 'Automatisch für Testdaten angelegt.',
        orgId,
      }),
    );
    if (additions.length) {
      await this.tagRepository.save(additions);
      created = additions.length;
      items = await this.tagRepository.find({ where: { orgId, active: true } });
    }
    return { items, created };
  }

  private async ensureLocations(orgId: string): Promise<{ items: Location[]; created: number }> {
    let items = await this.locationRepository.find({ where: { orgId, active: true } });
    let created = 0;
    if (items.length >= 3) return { items, created };

    const additions = LOCATION_LIBRARY.slice(0, Math.max(0, 4 - items.length)).map((entry) =>
      this.locationRepository.create({
        name: entry.name,
        roomType: entry.roomType,
        active: true,
        description: 'Automatisch für Testdaten angelegt.',
        orgId,
      }),
    );
    if (additions.length) {
      await this.locationRepository.save(additions);
      created = additions.length;
      items = await this.locationRepository.find({ where: { orgId, active: true } });
    }
    return { items, created };
  }

  private async ensureCohorts(orgId: string): Promise<{ items: Cohort[]; created: number }> {
    let items = await this.cohortRepository.find({ where: { orgId, active: true } });
    let created = 0;
    if (items.length >= 4) return { items, created };

    const additions = COHORT_LIBRARY.map((entry) =>
      this.cohortRepository.create({
        ...entry,
        active: true,
        inheritToChildren: false,
        orgId,
      }),
    );
    if (additions.length) {
      await this.cohortRepository.save(additions);
      created = additions.length;
      items = await this.cohortRepository.find({ where: { orgId, active: true } });
    }
    return { items, created };
  }

  private async ensureStaff(orgId: string): Promise<{ items: Staff[]; created: number }> {
    let items = await this.staffRepository.find({ where: { orgId, active: true } });
    let created = 0;
    if (items.length >= 3) return { items, created };

    const short = this.orgShort(orgId);
    const needed = Math.max(0, 4 - items.length);
    const additions = Array.from({ length: needed }, (_, index) =>
      this.staffRepository.create({
        name: `${this.pickOne(STAFF_NAMES)} Testdata ${index + 1}`,
        email: `testdata+${short}+${index + 1}@stato.local`,
        password: null,
        role: index === 0 ? StaffRole.LEAD : StaffRole.EMPLOYEE,
        active: true,
        phone: null,
        notes: 'Automatisch für Testdaten angelegt.',
        orgId,
      }),
    );
    if (additions.length) {
      await this.staffRepository.save(additions);
      created = additions.length;
      items = await this.staffRepository.find({ where: { orgId, active: true } });
    }
    return { items, created };
  }

  private async detachAndRemoveActivities(activities: Activity[]): Promise<number> {
    if (activities.length === 0) return 0;
    for (const activity of activities) {
      activity.tags = [];
      activity.categories = [];
      activity.staff = [];
      activity.attachments = [];
    }
    await this.activityRepository.save(activities, { chunk: 200 });
    await this.activityRepository.remove(activities, { chunk: 200 });
    return activities.length;
  }

  private async detachAndRemoveProjects(projects: Project[]): Promise<number> {
    if (projects.length === 0) return 0;
    for (const project of projects) {
      project.categories = [];
    }
    await this.projectRepository.save(projects, { chunk: 100 });
    await this.projectRepository.remove(projects, { chunk: 100 });
    return projects.length;
  }

  async removeGeneratedForOrg(orgId: string | null) {
    this.assertEnabled();
    if (!orgId) throw new BadRequestException('Bitte zuerst einen Organisations-Scope auswählen.');

    const generatedActivities = await applyActivityRelationJoins(
      this.activityRepository.createQueryBuilder('activity'),
      'activity',
      ['tags', 'categories', 'staff', 'attachments'],
    )
      .where('activity.orgId = :orgId', { orgId })
      .andWhere('activity.goals LIKE :marker', { marker: `%${TESTDATA_MARKER}%` })
      .getMany();

    const generatedProjects = await this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.categories', 'categories')
      .where('project.orgId = :orgId', { orgId })
      .andWhere('project.description LIKE :marker', { marker: `%${TESTDATA_MARKER}%` })
      .getMany();

    const deletedActivities = await this.detachAndRemoveActivities(generatedActivities);
    const deletedProjects = await this.detachAndRemoveProjects(generatedProjects);

    return {
      deletedActivities,
      deletedProjects,
    };
  }

  async generateForOrg(orgId: string | null, payload: GenerateTestDataDto) {
    this.assertEnabled();
    if (!orgId) throw new BadRequestException('Bitte zuerst einen Organisations-Scope auswählen.');

    const org = await this.organizationRepository.findOne({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organisation nicht gefunden.');

    const config = this.buildConfig(payload);
    const cleanup = config.clearExisting ? await this.removeGeneratedForOrg(orgId) : { deletedActivities: 0, deletedProjects: 0 };

    const [{ items: categories, created: createdCategories }, { items: tags, created: createdTags }, { items: locations, created: createdLocations }, { items: cohorts, created: createdCohorts }, { items: staff, created: createdStaff }] = await Promise.all([
      this.ensureCategories(orgId),
      this.ensureTags(orgId),
      this.ensureLocations(orgId),
      this.ensureCohorts(orgId),
      this.ensureStaff(orgId),
    ]);
    const employeeStaff = staff.filter(
      (member) => member.role === StaffRole.LEAD || member.role === StaffRole.EMPLOYEE,
    );
    const volunteerStaff = staff.filter(
      (member) => member.role === StaffRole.VOLUNTEER || member.role === StaffRole.HELPER,
    );
    const defaultStaffPool = employeeStaff.length > 0 ? employeeStaff : staff;

    const projectTemplates = Array.from({ length: config.projects }, (_, index) => {
      const template = PROJECT_LIBRARY[index % PROJECT_LIBRARY.length];
      const primaryCategory = this.pickOne(categories);
      const extraCategories = this.pickMany(categories.filter((category) => category.id !== primaryCategory.id), this.randomInt(0, 1));
      const startDate = this.dateMonthsBack(config.monthsBack);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + this.randomInt(2, 9));
      const time = this.buildTime(template.type);
      const pickedVolunteers = volunteerStaff.length
        ? this.pickMany(
            volunteerStaff,
            this.randomInt(0, Math.min(2, volunteerStaff.length)),
          )
            .map((member) => member.name)
            .join(', ')
        : '';
      return this.projectRepository.create({
        title: `[Testdaten] ${template.title} ${index + 1}`,
        type: template.type,
        categoryId: primaryCategory.id,
        categories: [primaryCategory, ...extraCategories],
        targetGroup: template.targetGroup,
        color: this.pickOne(PROJECT_COLORS),
        dateFrom: this.formatDate(startDate),
        dateTo: this.formatDate(endDate),
        defaultStartTime: time.startTime,
        defaultEndTime: time.endTime,
        defaultStaff: this.pickMany(
          defaultStaffPool,
          this.randomInt(1, Math.min(2, defaultStaffPool.length)),
        )
          .map((member) => member.name)
          .join(', '),
        defaultVolunteers:
          pickedVolunteers || (Math.random() > 0.7 ? 'Jugendleiter*in im Aufbau' : null),
        tag: template.tag,
        activityField: template.activityField,
        description: this.generatedDescription(template.description),
        archived: false,
        orgId,
      });
    });

    const projects = await this.projectRepository.save(projectTemplates, { chunk: 100 });

    const activities = Array.from({ length: config.activities }, (_, index) => {
      const linkedToProject = Math.random() > 0.33;
      const project = linkedToProject ? this.pickOne(projects) : null;
      const type = project
        ? project.type
        : this.chooseWeighted([
            { item: ActivityType.OPEN_DOOR, weight: 48 },
            { item: ActivityType.EVENT, weight: 17 },
            { item: ActivityType.OUTREACH, weight: 10 },
            { item: ActivityType.PROJECT_OPEN, weight: 18 },
            { item: ActivityType.PROJECT_CLOSED, weight: 7 },
          ]);
      const when = this.dateMonthsBack(config.monthsBack);
      const timing = this.buildTime(type);
      const counts = this.buildActivityCounts(type, cohorts);
      const assignedStaff = this.pickMany(staff, this.randomInt(1, Math.min(3, staff.length)));
      const assignedCategories = project?.categories?.length
        ? project.categories
        : this.pickMany(categories, this.randomInt(1, Math.min(2, categories.length)));
      const assignedTags = this.pickMany(tags, this.randomInt(0, Math.min(3, tags.length)));
      const note = this.activityNote(type);
      const title =
        project && Math.random() > 0.6
          ? null
          : type === ActivityType.OPEN_DOOR
            ? this.pickOne(OPEN_DOOR_TITLES)
            : type === ActivityType.EVENT
              ? `${this.pickOne(EVENT_TITLES)} ${Math.ceil((index + 1) / 5)}`
              : type === ActivityType.OUTREACH
                ? this.pickOne(OUTREACH_TITLES)
                : `${project?.title || 'Gruppenangebot'} Termin ${this.randomInt(1, 18)}`;

      return this.activityRepository.create({
        date: when,
        startTime: timing.startTime,
        endTime: timing.endTime,
        durationMinutes: timing.durationMinutes,
        type,
        locationId: this.pickOne(locations).id,
        projectId: project?.id ?? null,
        title,
        categories: assignedCategories,
        tags: assignedTags,
        staff: assignedStaff,
        countMale: counts.male,
        countFemale: counts.female,
        countDiverse: counts.diverse,
        countTotal: counts.total,
        notes: note ?? undefined,
        goals: TESTDATA_MARKER,
        cohorts: counts.cohortRows,
        createdById: assignedStaff[0]?.id ?? null,
        updatedById: assignedStaff[0]?.id ?? null,
        ackDone: Math.random() > 0.8,
        orgId,
      });
    });

    await this.activityRepository.save(activities, { chunk: 250 });

    return {
      orgId,
      orgName: org.name,
      preset: config.preset,
      config: {
        projects: config.projects,
        activities: config.activities,
        monthsBack: config.monthsBack,
        clearExisting: config.clearExisting,
      },
      cleanedUp: cleanup,
      created: {
        projects: projects.length,
        activities: activities.length,
        categories: createdCategories,
        tags: createdTags,
        locations: createdLocations,
        cohorts: createdCohorts,
        staff: createdStaff,
      },
    };
  }
}