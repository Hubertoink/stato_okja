/**
 * Performance Test Seed Script
 * 
 * Generates large amounts of test data to stress-test the database and backend.
 * 
 * Usage: npm run seed
 * 
 * Configuration via environment variables:
 *   SEED_ORGS=5          Number of organizations (default: 5)
 *   SEED_STAFF_PER_ORG=10  Staff per org (default: 10)
 *   SEED_ACTIVITIES=10000  Total activities to generate (default: 10000)
 *   SEED_PROJECTS_PER_ORG=8 Projects per org (default: 8)
 *   SEED_CLEAR=true       Clear existing data first (default: false)
 */

import { DataSource, IsNull, Not } from 'typeorm';
import { typeormConfig } from '../../config/typeorm.config';
import { Organization } from '../../orgs/entities/organization.entity';
import { Staff } from '../../staff/entities/staff.entity';
import { Category } from '../../taxonomy/entities/category.entity';
import { Tag } from '../../taxonomy/entities/tag.entity';
import { Location } from '../../locations/entities/location.entity';
import { Project } from '../../projects/entities/project.entity';
import { Activity } from '../../activities/entities/activity.entity';
import { normalizeActivityMetrics } from '../../activities/activity-metrics';
import { StaffRole, ActivityType } from '../../common/enums';
import * as bcrypt from 'bcryptjs';

function assertNotProduction() {
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
  const appEnv = (process.env.APP_ENV || '').toLowerCase();
  const isProd = nodeEnv === 'production' || appEnv === 'production';
  const allowProd = (process.env.SEED_ALLOW_PROD || '').toLowerCase() === 'true';
  if (isProd && !allowProd) {
    console.error(
      '❌ Refusing to run seed script in production. Set SEED_ALLOW_PROD=true to override (DANGEROUS).',
    );
    process.exit(1);
  }
}

// Configuration
const CONFIG = {
  orgs: parseInt(process.env.SEED_ORGS || '5', 10),
  staffPerOrg: parseInt(process.env.SEED_STAFF_PER_ORG || '10', 10),
  activities: parseInt(process.env.SEED_ACTIVITIES || '10000', 10),
  projectsPerOrg: parseInt(process.env.SEED_PROJECTS_PER_ORG || '8', 10),
  categoriesPerOrg: 6,
  tagsPerOrg: 12,
  locationsPerOrg: 5,
  clearExisting: process.env.SEED_CLEAR === 'true',
};

// Helper functions
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomElements<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

function randomDate(startYear: number, endYear: number): Date {
  const start = new Date(startYear, 0, 1);
  const end = new Date(endYear, 11, 31);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatTime(hours: number, minutes: number): string {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function generateRandomTime(): { start: string; end: string; duration: number } {
  const startHour = randomInt(8, 18);
  const startMin = randomElement([0, 15, 30, 45]);
  const durationMins = randomElement([30, 45, 60, 90, 120, 180, 240]);
  const endDate = new Date(2000, 0, 1, startHour, startMin + durationMins);
  return {
    start: formatTime(startHour, startMin),
    end: formatTime(endDate.getHours(), endDate.getMinutes()),
    duration: durationMins,
  };
}

// German names for realistic data
const FIRST_NAMES = [
  'Anna', 'Max', 'Sophie', 'Lukas', 'Emma', 'Leon', 'Marie', 'Paul', 'Hannah', 'Felix',
  'Laura', 'Jonas', 'Lena', 'Tim', 'Julia', 'David', 'Sarah', 'Niklas', 'Lisa', 'Jan',
  'Katharina', 'Moritz', 'Franziska', 'Simon', 'Christina', 'Tobias', 'Nina', 'Florian',
  'Amelie', 'Philipp', 'Vanessa', 'Michael', 'Jennifer', 'Alexander', 'Stefanie', 'Daniel',
];

const LAST_NAMES = [
  'Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker',
  'Schulz', 'Hoffmann', 'Schäfer', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf',
  'Schröder', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun', 'Krüger', 'Hofmann', 'Hartmann',
  'Lange', 'Schmitt', 'Werner', 'Schmitz', 'Krause', 'Meier', 'Lehmann', 'Schmid',
];

const ORG_PREFIXES = ['Jugendhaus', 'Jugendzentrum', 'Treff', 'Haus der Jugend', 'Jugendclub'];
const ORG_SUFFIXES = ['Nord', 'Süd', 'Ost', 'West', 'Mitte', 'Altstadt', 'Neustadt'];
const CITY_DISTRICTS = ['Kreuzberg', 'Neukölln', 'Mitte', 'Prenzlauer Berg', 'Friedrichshain', 'Charlottenburg'];

const CATEGORY_NAMES = [
  'Bildung & Lernen', 'Sport & Bewegung', 'Kunst & Kreativ', 'Musik & Tanz',
  'Medien & Digital', 'Kochen & Ernährung', 'Beratung & Gespräch', 'Ausflüge & Fahrten',
  'Partizipation', 'Inklusion', 'Internationale Arbeit', 'Umwelt & Nachhaltigkeit',
];

const TAG_NAMES = [
  'Ferienangebot', 'Wochenende', 'Mädchen*', 'Jungen*', 'LGBTQ+', 'Outdoor',
  'Indoor', 'Elternarbeit', 'Kooperation', 'Schule', 'Ehrenamt', 'Inklusion',
  'Niedrigschwellig', 'Anmeldepflichtig', 'Kostenfrei', 'Förderprogramm',
  'Präventionsarbeit', 'Medienbildung', 'Demokratiebildung', 'Kulturarbeit',
];

const LOCATION_TYPES = ['Gruppenraum', 'Sporthalle', 'Außengelände', 'Werkstatt', 'Küche', 'Multiraum', 'Büro'];

const PROJECT_TITLES = [
  'Herbstferiencamp', 'Sommercamp 2025', 'Mädchen*treff', 'Jungengruppe', 
  'Hip-Hop Workshop', 'Graffiti Projekt', 'Coding für Kids', 'Gaming Club',
  'Kochkurs International', 'Sportturnier', 'Theaterprojekt', 'Bandprobe',
  'Hausaufgabenhilfe', 'Berufsorientierung', 'Demokratie-Werkstatt', 'Umwelt-AG',
  'Foto-Workshop', 'Film-Projekt', 'Podcast-Studio', 'Social Media Team',
];

const ACTIVITY_TITLES = [
  'Offener Treff', 'Gruppenangebot', 'Workshop', 'Beratungsgespräch', 'Ausflug',
  'Turnier', 'Probe', 'Training', 'Kurs', 'AG-Treffen', 'Projektarbeit',
  'Aktionstag', 'Infoveranstaltung', 'Elternabend', 'Teamsitzung', 'Netzwerktreffen',
];

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
];

async function main() {
  assertNotProduction();
  console.log('🚀 Starting Performance Test Seed...\n');
  console.log('Configuration:');
  console.log(`  - Organizations: ${CONFIG.orgs}`);
  console.log(`  - Staff per Org: ${CONFIG.staffPerOrg}`);
  console.log(`  - Activities: ${CONFIG.activities}`);
  console.log(`  - Projects per Org: ${CONFIG.projectsPerOrg}`);
  console.log(`  - Clear existing: ${CONFIG.clearExisting}\n`);

  const dataSource = new DataSource(typeormConfig);
  await dataSource.initialize();
  console.log('✅ Database connected\n');

  const orgRepo = dataSource.getRepository(Organization);
  const staffRepo = dataSource.getRepository(Staff);
  const categoryRepo = dataSource.getRepository(Category);
  const tagRepo = dataSource.getRepository(Tag);
  const locationRepo = dataSource.getRepository(Location);
  const projectRepo = dataSource.getRepository(Project);
  const activityRepo = dataSource.getRepository(Activity);

  // Clear existing data if requested
  if (CONFIG.clearExisting) {
    console.log('🗑️  Clearing existing data...');
    await activityRepo.query('TRUNCATE TABLE activity_categories CASCADE');
    await activityRepo.query('TRUNCATE TABLE activity_tags CASCADE');
    await activityRepo.query('TRUNCATE TABLE activity_staff CASCADE');
    await activityRepo.query('TRUNCATE TABLE project_categories CASCADE');
    const allRows = { id: Not(IsNull()) };
    await activityRepo.delete(allRows);
    await projectRepo.delete(allRows);
    await locationRepo.delete(allRows);
    await tagRepo.delete(allRows);
    await categoryRepo.delete(allRows);
    await staffRepo.delete(allRows);
    await orgRepo.delete(allRows);
    console.log('✅ Data cleared\n');
  }

  // Track created entities per org
  const orgData: Map<string, {
    org: Organization;
    staff: Staff[];
    categories: Category[];
    tags: Tag[];
    locations: Location[];
    projects: Project[];
  }> = new Map();

  // 1. Create Organizations (with hierarchy)
  console.log('📁 Creating organizations...');
  const orgs: Organization[] = [];
  
  for (let i = 0; i < CONFIG.orgs; i++) {
    const org = orgRepo.create({
      name: `${randomElement(ORG_PREFIXES)} ${randomElement(CITY_DISTRICTS)}`,
      parentId: null,
      path: null,
    });
    const savedOrg = await orgRepo.save(org);
    savedOrg.path = savedOrg.id;
    await orgRepo.save(savedOrg);
    orgs.push(savedOrg);
    
    // Create 1-2 child orgs for each parent
    if (Math.random() > 0.3) {
      const childOrg = orgRepo.create({
        name: `${savedOrg.name} - ${randomElement(ORG_SUFFIXES)}`,
        parentId: savedOrg.id,
        path: `${savedOrg.id}`,
      });
      const savedChild = await orgRepo.save(childOrg);
      savedChild.path = `${savedOrg.id}/${savedChild.id}`;
      await orgRepo.save(savedChild);
      orgs.push(savedChild);
    }
  }
  console.log(`✅ Created ${orgs.length} organizations\n`);

  // 2. Create Staff, Categories, Tags, Locations for each org
  console.log('👥 Creating staff, categories, tags, locations...');
  const hashedPassword = await bcrypt.hash('Test1234!', 10);
  
  for (const org of orgs) {
    // Staff
    const staffList: Staff[] = [];
    const roles = Object.values(StaffRole);
    
    for (let i = 0; i < CONFIG.staffPerOrg; i++) {
      const firstName = randomElement(FIRST_NAMES);
      const lastName = randomElement(LAST_NAMES);
      const staff = staffRepo.create({
        name: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${org.id.slice(0, 4)}@test.local`,
        password: hashedPassword,
        role: i === 0 ? StaffRole.ADMIN : randomElement(roles),
        active: Math.random() > 0.1,
        phone: Math.random() > 0.5 ? `0${randomInt(151, 179)} ${randomInt(1000000, 9999999)}` : null,
        orgId: org.id,
      });
      staffList.push(await staffRepo.save(staff));
    }

    // Categories
    const categories: Category[] = [];
    const categorySelection = randomElements(CATEGORY_NAMES, CONFIG.categoriesPerOrg);
    for (const name of categorySelection) {
      const cat = categoryRepo.create({
        name,
        color: randomElement(COLORS),
        active: true,
        orgId: org.id,
      });
      categories.push(await categoryRepo.save(cat));
    }

    // Tags
    const tags: Tag[] = [];
    const tagSelection = randomElements(TAG_NAMES, CONFIG.tagsPerOrg);
    for (const name of tagSelection) {
      // Make tag name unique by adding org id
      const uniqueName = `${name} [${org.id.slice(0, 8)}]`;
      // Check if tag already exists (unique constraint)
      const existing = await tagRepo.findOne({ where: { name: uniqueName } });
      if (!existing) {
        const tag = tagRepo.create({
          name: uniqueName,
          color: randomElement(COLORS),
          active: true,
          orgId: org.id,
        });
        tags.push(await tagRepo.save(tag));
      }
    }

    // Locations
    const locations: Location[] = [];
    for (let i = 0; i < CONFIG.locationsPerOrg; i++) {
      const loc = locationRepo.create({
        name: `${randomElement(LOCATION_TYPES)} ${i + 1}`,
        roomType: randomElement(LOCATION_TYPES),
        address: `${org.name}, Raum ${i + 1}`,
        active: true,
        orgId: org.id,
      });
      locations.push(await locationRepo.save(loc));
    }

    // Projects
    const projects: Project[] = [];
    const projectSelection = randomElements(PROJECT_TITLES, CONFIG.projectsPerOrg);
    for (const title of projectSelection) {
      const dateFrom = randomDate(2024, 2025);
      const dateTo = new Date(dateFrom);
      dateTo.setMonth(dateTo.getMonth() + randomInt(1, 6));
      
      const project = projectRepo.create({
        title: `${title} (${org.name.slice(0, 15)})`,
        type: randomElement(Object.values(ActivityType)),
        color: randomElement(COLORS),
        dateFrom: formatDate(dateFrom),
        dateTo: formatDate(dateTo),
        targetGroup: randomElement(['6-12 Jahre', '12-18 Jahre', '14-21 Jahre', 'Alle']),
        archived: Math.random() > 0.85,
        orgId: org.id,
        categories: randomElements(categories, randomInt(1, 3)),
      });
      projects.push(await projectRepo.save(project));
    }

    orgData.set(org.id, { org, staff: staffList, categories, tags, locations, projects });
  }
  console.log('✅ Created staff, categories, tags, locations, projects\n');

  // 3. Create Activities (in batches for performance)
  console.log(`📊 Creating ${CONFIG.activities} activities...`);
  const BATCH_SIZE = 500;
  const activityTypes = Object.values(ActivityType);
  let created = 0;

  const allOrgs = Array.from(orgData.values());
  
  while (created < CONFIG.activities) {
    const batch: Partial<Activity>[] = [];
    const batchSize = Math.min(BATCH_SIZE, CONFIG.activities - created);

    for (let i = 0; i < batchSize; i++) {
      const orgEntry = randomElement(allOrgs);
      const { org, staff, categories, tags, locations, projects } = orgEntry;
      
      const activityDate = randomDate(2023, 2026);
      const time = generateRandomTime();
      const hasProject = Math.random() > 0.4;
      const project = hasProject ? randomElement(projects) : null;

      // Teilnehmende
      const countMale = randomInt(0, 25);
      const countFemale = randomInt(0, 25);
      const countDiverse = randomInt(0, 5);
      const countTotal = countMale + countFemale + countDiverse;

      const activity: Partial<Activity> = {
        date: activityDate,
        startTime: time.start,
        endTime: time.end,
        durationMinutes: time.duration,
        type: project?.type || randomElement(activityTypes),
        title: hasProject ? null : `${randomElement(ACTIVITY_TITLES)} ${randomInt(1, 100)}`,
        countMale,
        countFemale,
        countDiverse,
        countTotal,
        notes: Math.random() > 0.7 ? `Notizen zur Aktivität am ${formatDate(activityDate)}. Alles gut gelaufen.` : undefined,
        goals: Math.random() > 0.8 ? 'Förderung der Teamfähigkeit, soziales Lernen' : undefined,
        locationId: locations.length > 0 ? randomElement(locations).id : null,
        projectId: project?.id || null,
        createdById: randomElement(staff).id,
        orgId: org.id,
        ackDone: Math.random() > 0.3,
        categories: randomElements(categories, randomInt(0, 3)),
        tags: randomElements(tags, randomInt(0, 4)),
        staff: randomElements(staff, randomInt(1, 4)),
      };

      normalizeActivityMetrics(activity);
      batch.push(activity);
    }

    // Save batch
    await activityRepo.save(batch as Activity[]);
    created += batchSize;
    
    const progress = Math.round((created / CONFIG.activities) * 100);
    process.stdout.write(`\r  Progress: ${progress}% (${created}/${CONFIG.activities})`);
  }
  
  console.log('\n✅ Activities created\n');

  // Summary
  const totalOrgs = await orgRepo.count();
  const totalStaff = await staffRepo.count();
  const totalCategories = await categoryRepo.count();
  const totalTags = await tagRepo.count();
  const totalLocations = await locationRepo.count();
  const totalProjects = await projectRepo.count();
  const totalActivities = await activityRepo.count();

  console.log('📈 Summary:');
  console.log(`  - Organizations: ${totalOrgs}`);
  console.log(`  - Staff: ${totalStaff}`);
  console.log(`  - Categories: ${totalCategories}`);
  console.log(`  - Tags: ${totalTags}`);
  console.log(`  - Locations: ${totalLocations}`);
  console.log(`  - Projects: ${totalProjects}`);
  console.log(`  - Activities: ${totalActivities}`);
  
  // Estimate DB size
  const sizeResult = await dataSource.query(`
    SELECT pg_size_pretty(pg_database_size(current_database())) as size
  `);
  console.log(`  - Database size: ${sizeResult[0]?.size || 'N/A'}`);

  console.log('\n✅ Seed completed successfully!');
  
  await dataSource.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
