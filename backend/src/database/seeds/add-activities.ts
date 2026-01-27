/**
 * Add Activities Script - Adds more test activities to existing data
 * 
 * Usage: npx ts-node src/database/seeds/add-activities.ts
 */

import { DataSource } from 'typeorm';
import { typeormConfig } from '../../config/typeorm.config';
import { Organization } from '../../orgs/entities/organization.entity';
import { Staff } from '../../staff/entities/staff.entity';
import { Category } from '../../taxonomy/entities/category.entity';
import { Tag } from '../../taxonomy/entities/tag.entity';
import { Location } from '../../locations/entities/location.entity';
import { Project } from '../../projects/entities/project.entity';
import { Activity } from '../../activities/entities/activity.entity';
import { ActivityType } from '../../common/enums';

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

async function main() {
  assertNotProduction();
  const COUNT = parseInt(process.env.SEED_COUNT || '300', 10);
  console.log(`🚀 Adding ${COUNT} activities to existing data...\n`);

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

  // Get existing data
  const orgs = await orgRepo.find();
  if (orgs.length === 0) {
    console.log('❌ No organizations found. Please run seed:quick first.');
    await dataSource.destroy();
    process.exit(1);
  }
  const org = orgs[0];
  console.log(`📁 Using organization: ${org.name}`);

  const staff = await staffRepo.find({ where: { orgId: org.id } });
  const categories = await categoryRepo.find({ where: { orgId: org.id } });
  const tags = await tagRepo.find({ where: { orgId: org.id } });
  const locations = await locationRepo.find({ where: { orgId: org.id } });
  const projects = await projectRepo.find({ where: { orgId: org.id } });

  console.log(`👥 Found ${staff.length} staff members`);
  console.log(`📂 Found ${categories.length} categories`);
  console.log(`🏷️  Found ${tags.length} tags`);
  console.log(`📍 Found ${locations.length} locations`);
  console.log(`📋 Found ${projects.length} projects`);

  if (staff.length === 0 || locations.length === 0) {
    console.log('❌ Missing required data. Please run seed:quick first.');
    await dataSource.destroy();
    process.exit(1);
  }

  // Activity types with weights for realistic distribution
  const typeWeights = [
    { type: ActivityType.OPEN_DOOR, weight: 40 },
    { type: ActivityType.PROJECT_OPEN, weight: 30 },
    { type: ActivityType.PROJECT_CLOSED, weight: 15 },
    { type: ActivityType.EVENT, weight: 10 },
    { type: ActivityType.OUTREACH, weight: 5 },
  ];

  const titles: Record<string, string[]> = {
    [ActivityType.OPEN_DOOR]: ['Offener Treff', 'Offene Tür', 'Treffpunkt', 'Open House'],
    [ActivityType.EVENT]: ['Sommerfest', 'Workshop', 'Themennachmittag', 'Aktionstag', 'Infoabend'],
    [ActivityType.OUTREACH]: ['Streetwork', 'Aufsuchende Arbeit', 'Mobile Jugendarbeit'],
  };

  // Generate date within range (last 90 days)
  const generateDate = () => {
    const today = new Date();
    const daysAgo = Math.floor(Math.random() * 90);
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    return date;
  };

  // Pick random type based on weights
  const pickType = () => {
    const totalWeight = typeWeights.reduce((sum, t) => sum + t.weight, 0);
    let random = Math.random() * totalWeight;
    for (const t of typeWeights) {
      random -= t.weight;
      if (random <= 0) return t.type;
    }
    return ActivityType.OPEN_DOOR;
  };

  // Generate activities
  console.log(`\n📊 Creating ${COUNT} activities...`);
  const activities: Partial<Activity>[] = [];

  for (let i = 0; i < COUNT; i++) {
    const type = pickType();
    const isProjectActivity = type === ActivityType.PROJECT_OPEN || type === ActivityType.PROJECT_CLOSED;
    const project = isProjectActivity && projects.length > 0
      ? projects[Math.floor(Math.random() * projects.length)]
      : null;

    const countMale = Math.floor(Math.random() * 20);
    const countFemale = Math.floor(Math.random() * 20);
    const countDiverse = Math.floor(Math.random() * 4);
    const countTotal = countMale + countFemale + countDiverse;

    // Random duration between 60 and 300 minutes
    const durationMinutes = 60 + Math.floor(Math.random() * 240);
    const startHour = 9 + Math.floor(Math.random() * 8); // 9:00 - 17:00
    const startTime = `${String(startHour).padStart(2, '0')}:00`;
    const endHour = startHour + Math.floor(durationMinutes / 60);
    const endMinutes = durationMinutes % 60;
    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;

    const titleOptions = titles[type];
    const title = titleOptions
      ? titleOptions[Math.floor(Math.random() * titleOptions.length)]
      : null;

    // Random categories (0-2)
    const numCats = Math.floor(Math.random() * 3);
    const shuffledCats = [...categories].sort(() => Math.random() - 0.5);
    const activityCategories = shuffledCats.slice(0, numCats);

    // Random tags (0-2)
    const numTags = Math.floor(Math.random() * 3);
    const shuffledTags = [...tags].sort(() => Math.random() - 0.5);
    const activityTags = shuffledTags.slice(0, numTags);

    // Random notes (30% chance)
    const notes = Math.random() < 0.3
      ? [
          'Gute Stimmung, viele neue Gesichter.',
          'Heute war es etwas ruhiger als sonst.',
          'Einige Jugendliche haben beim Aufräumen geholfen.',
          'Neues Angebot wurde gut angenommen.',
          'Gespräche über Ausbildungsmöglichkeiten.',
        ][Math.floor(Math.random() * 5)]
      : undefined;

    activities.push({
      date: generateDate(),
      startTime,
      endTime,
      durationMinutes,
      type,
      title,
      countMale,
      countFemale,
      countDiverse,
      countTotal,
      locationId: locations[Math.floor(Math.random() * locations.length)].id,
      projectId: project?.id || null,
      createdById: staff[Math.floor(Math.random() * staff.length)].id,
      orgId: org.id,
      categories: activityCategories,
      tags: activityTags,
      staff: [staff[Math.floor(Math.random() * staff.length)]],
      notes,
    });
  }

  // Save in batches
  const batchSize = 50;
  let saved = 0;
  for (let i = 0; i < activities.length; i += batchSize) {
    const batch = activities.slice(i, i + batchSize);
    await activityRepo.save(batch as Activity[]);
    saved += batch.length;
    process.stdout.write(`\r   Saved ${saved}/${COUNT} activities...`);
  }

  console.log('\n\n✅ Activities added successfully!');
  
  const totalActivities = await activityRepo.count({ where: { orgId: org.id } });
  console.log(`\n📈 Total activities now: ${totalActivities}`);

  await dataSource.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
