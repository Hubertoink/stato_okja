/**
 * Quick Seed Script - Generates minimal test data for development
 * 
 * Usage: npm run seed:quick
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

async function main() {
  assertNotProduction();
  console.log('🚀 Quick Seed - Creating minimal test data...\n');

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

  // Check if data already exists
  const existingOrgs = await orgRepo.count();
  if (existingOrgs > 0) {
    console.log('⚠️  Data already exists. Use SEED_CLEAR=true npm run seed to clear first.');
    console.log(`   Current: ${existingOrgs} organizations, ${await activityRepo.count()} activities`);
    await dataSource.destroy();
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash('Test1234!', 10);

  // 1. Create Test Organization
  console.log('📁 Creating test organization...');
  const org = await orgRepo.save(orgRepo.create({
    name: 'Jugendhaus Test',
    parentId: null,
    path: null,
  }));
  org.path = org.id;
  await orgRepo.save(org);

  // 2. Create Admin Staff
  console.log('👥 Creating test staff...');
  const admin = await staffRepo.save(staffRepo.create({
    name: 'Test Admin',
    email: 'admin@test.local',
    password: hashedPassword,
    role: StaffRole.ADMIN,
    active: true,
    orgId: org.id,
  }));

  const employee = await staffRepo.save(staffRepo.create({
    name: 'Test Mitarbeiter',
    email: 'mitarbeiter@test.local',
    password: hashedPassword,
    role: StaffRole.EMPLOYEE,
    active: true,
    orgId: org.id,
  }));

  // 3. Create Categories
  console.log('📂 Creating categories...');
  const categories = await categoryRepo.save([
    categoryRepo.create({ name: 'Bildung', color: '#3b82f6', orgId: org.id }),
    categoryRepo.create({ name: 'Sport', color: '#22c55e', orgId: org.id }),
    categoryRepo.create({ name: 'Kreativ', color: '#a855f7', orgId: org.id }),
  ]);

  // 4. Create Tags
  console.log('🏷️  Creating tags...');
  const tags = await tagRepo.save([
    tagRepo.create({ name: 'Outdoor', color: '#16a34a', orgId: org.id }),
    tagRepo.create({ name: 'Indoor', color: '#6366f1', orgId: org.id }),
    tagRepo.create({ name: 'Ferienangebot', color: '#f59e0b', orgId: org.id }),
  ]);

  // 5. Create Location
  console.log('📍 Creating locations...');
  const locations = await locationRepo.save([
    locationRepo.create({ name: 'Gruppenraum 1', roomType: 'Gruppenraum', orgId: org.id }),
    locationRepo.create({ name: 'Sporthalle', roomType: 'Sporthalle', orgId: org.id }),
  ]);

  // 6. Create Projects
  console.log('📋 Creating projects...');
  const projects = await projectRepo.save([
    projectRepo.create({
      title: 'Sommercamp 2025',
      type: ActivityType.PROJECT_OPEN,
      color: '#f97316',
      dateFrom: '2025-07-01',
      dateTo: '2025-08-31',
      orgId: org.id,
      categories: [categories[0]],
    }),
    projectRepo.create({
      title: 'Mädchen*treff',
      type: ActivityType.PROJECT_CLOSED,
      color: '#ec4899',
      orgId: org.id,
      categories: [categories[2]],
    }),
  ]);

  // 7. Create some Activities
  console.log('📊 Creating sample activities...');
  const today = new Date();
  const activities: Partial<Activity>[] = [];
  
  for (let i = 0; i < 50; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - Math.floor(Math.random() * 90));
    
    activities.push({
      date,
      startTime: '14:00',
      endTime: '17:00',
      durationMinutes: 180,
      type: i % 3 === 0 ? ActivityType.OPEN_DOOR : ActivityType.PROJECT_OPEN,
      title: i % 3 === 0 ? 'Offener Treff' : null,
      countMale: Math.floor(Math.random() * 15),
      countFemale: Math.floor(Math.random() * 15),
      countDiverse: Math.floor(Math.random() * 3),
      countTotal: 0, // Will be calculated
      locationId: locations[i % 2].id,
      projectId: i % 3 === 0 ? null : projects[i % 2].id,
      createdById: i % 2 === 0 ? admin.id : employee.id,
      orgId: org.id,
      categories: [categories[i % 3]],
      tags: i % 4 === 0 ? [tags[0]] : [],
      staff: [admin],
    });
  }

  activities.forEach(normalizeActivityMetrics);

  await activityRepo.save(activities as Activity[]);

  console.log('\n✅ Quick Seed completed!');
  console.log('\n📈 Created:');
  console.log('  - 1 Organization');
  console.log('  - 2 Staff members');
  console.log('  - 3 Categories');
  console.log('  - 3 Tags');
  console.log('  - 2 Locations');
  console.log('  - 2 Projects');
  console.log('  - 50 Activities');
  console.log('\n🔑 Login credentials:');
  console.log('  - Email: admin@test.local');
  console.log('  - Password: Test1234!');

  await dataSource.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
