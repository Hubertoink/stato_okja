const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { unlink } = require('node:fs/promises');
const { join } = require('node:path');
const { DataSource, In } = require('typeorm');
const { JwtService } = require('@nestjs/jwt');
const sharp = require('sharp');
const { typeormConfig } = require('/app/dist/config/typeorm.config');
const { StoredUploadScopes20260909120000 } = require('/app/dist/database/migrations/20260909120000-stored-upload-scopes');
const { ActivityVersion20260909121000 } = require('/app/dist/database/migrations/20260909121000-activity-version');

async function main() {
  assert.equal(process.env.DB_DATABASE, 'stato_review', 'Only the disposable stato_review environment is allowed');
  const database = await new DataSource({ ...typeormConfig, migrationsRun: false, synchronize: false }).initialize();
  const orgIds = [randomUUID(), randomUUID()];
  const userIds = [randomUUID(), randomUUID()];
  const files = [];
  const scopeKeys = orgIds.map((id) => `org:${id}`);
  const repository = (name) => database.getRepository(name);
  try {
    const schema = `review_${randomUUID().replaceAll('-', '')}`;
    await database.query(`CREATE SCHEMA "${schema}"`);
    let upgrade;
    try {
      upgrade = await new DataSource({ ...typeormConfig, schema, extra: { options: `-c search_path=${schema},public` }, migrationsRun: false, synchronize: false }).initialize();
      const runner = upgrade.createQueryRunner();
      await runner.connect();
      try {
        for (const statement of [
          'CREATE TABLE projects ("imageUrl" text, "orgId" uuid)',
          'CREATE TABLE project_templates ("imageUrl" text, "orgId" uuid)',
          'CREATE TABLE organizations (id uuid, "bannerUrl" text)',
          'CREATE TABLE users (id uuid, role text, "orgId" uuid, "avatarUrl" text)',
          'CREATE TABLE organization_memberships ("userId" uuid, "orgId" uuid, status text)',
          'CREATE TABLE processes ("orgId" uuid, definition text)',
          'CREATE TABLE activities (id uuid)',
        ]) await runner.query(statement);
        await new StoredUploadScopes20260909120000().up(runner);
        await new StoredUploadScopes20260909120000().up(runner);
        await new ActivityVersion20260909121000().up(runner);
        const saved = await upgrade.getRepository('StoredUpload').save({ filename: 'upgrade.pdf', kind: 'process-file', scopeKey: 'global', size: 12 });
        assert.match(saved.id, /^[0-9a-f-]{36}$/);
        const columns = await runner.getTable('activities');
        assert(columns.columns.some((column) => column.name === 'version'));
        console.log('PASS PostgreSQL upgrade migrations and generated upload UUID');
      } finally {
        await runner.release();
      }
    } finally {
      if (upgrade) await upgrade.destroy();
      await database.query(`DROP SCHEMA "${schema}" CASCADE`);
    }

    const tokens = [];
    for (let index = 0; index < 2; index += 1) {
      await repository('Organization').save({ id: orgIds[index], name: 'Disposable security smoke', parentId: index ? orgIds[0] : null, path: orgIds.slice(0, index + 1).join('/') });
      await repository('User').save({ id: userIds[index], email: `${userIds[index]}@review.invalid`, name: 'Disposable smoke user', role: 'editor', orgId: orgIds[index] });
      await repository('OrganizationMembership').save({ userId: userIds[index], orgId: orgIds[index], role: 'editor', status: 'active' });
      const session = await repository('RefreshSession').save({ userId: userIds[index], tokenId: randomUUID(), tokenHash: 'test-only', csrfHash: 'test-only', expiresAt: new Date(Date.now() + 600000), createdAt: new Date(), lastUsedAt: new Date() });
      tokens.push(new JwtService().sign({ sub: userIds[index], sid: session.id }, { secret: process.env.JWT_SECRET, expiresIn: '10m' }));
    }
    const request = (index, path, options = {}) => fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api${path}`, {
      ...options, headers: { Authorization: `Bearer ${tokens[index]}`, 'X-Org-Scope': orgIds[index], ...options.headers },
    });
    const upload = async (index, path, bytes, mime, filename) => {
      const form = new FormData();
      form.append('file', new Blob([bytes], { type: mime }), filename);
      const response = await request(index, path, { method: 'POST', body: form });
      const result = await response.json();
      if (result.url) files.push(result.url);
      return { response, result };
    };
    const pdf = Buffer.from('%PDF-1.4\nreview test\n%%EOF');
    const uploaded = await upload(0, '/uploads/files', pdf, 'application/pdf', `${'long'.repeat(100)}.pdf`);
    assert.equal(uploaded.response.status, 201, JSON.stringify(uploaded.result));
    assert.equal((await request(0, uploaded.result.url)).status, 200);
    assert.equal((await request(1, uploaded.result.url)).status, 404);
    assert.equal((await fetch(`http://127.0.0.1:3000/api${uploaded.result.url}`)).status, 401);
    console.log('PASS file tenant isolation, anonymous denial and bounded filenames');

    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ff0000' } }).png().toBuffer();
    const image = await upload(0, '/uploads/images', png, 'image/png', 'template.png');
    assert.equal(image.response.status, 201, JSON.stringify(image.result));
    assert.equal((await request(1, image.result.url)).status, 404);
    const template = await repository('ProjectTemplate').save({ title: 'Disposable template', type: 'event', orgId: orgIds[0], imageUrl: image.result.url });
    assert.equal((await request(1, image.result.url)).status, 200);
    console.log('PASS private image denial and inherited template image sharing');
    const projectResponse = await request(1, '/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Adopted template image', type: 'event', imageUrl: image.result.url }),
    });
    assert.equal(projectResponse.status, 201, await projectResponse.text());
    await repository('ProjectTemplate').update(template.id, { archived: true });
    assert.equal((await request(1, image.result.url)).status, 200);
    await repository('ProjectTemplate').delete(template.id);
    assert.equal((await request(1, image.result.url)).status, 200);
    assert.equal(Number(await repository('StoredUpload').sum('size', { scopeKey: scopeKeys[1] })), image.result.size);
    console.log('PASS adopted project image survives template archive/deletion and counts toward quota');


    const quota = Number(process.env.UPLOAD_SCOPE_QUOTA_BYTES || 536870912);
    const used = Number(await repository('StoredUpload').sum('size', { scopeKey: scopeKeys[0] }));
    const reservation = await repository('StoredUpload').save({ filename: 'quota-reservation.pdf', kind: 'process-file', scopeKey: scopeKeys[0], size: quota - used - pdf.length });
    const uploads = await Promise.all([upload(0, '/uploads/files', pdf, 'application/pdf', 'one.pdf'), upload(0, '/uploads/files', pdf, 'application/pdf', 'two.pdf')]);
    assert.deepEqual(uploads.map((entry) => entry.response.status).sort(), [201, 400]);
    await repository('StoredUpload').delete(reservation.id);
    console.log('PASS concurrent PostgreSQL quota reservations');

    const created = await request(0, '/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: '2026-09-09', title: 'Disposable activity', type: 'event' }) });
    const activity = await created.json();
    assert.equal(created.status, 201, JSON.stringify(activity));
    const saves = await Promise.all(['First', 'Second'].map((title) => request(0, `/activities/${activity.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, expectedVersion: activity.version }) })));
    assert.deepEqual(saves.map((response) => response.status).sort(), [200, 409]);
    const current = await (await request(0, `/activities/${activity.id}`)).json();
    assert.equal(current.version, activity.version + 1);
    console.log('PASS concurrent PostgreSQL activity updates: one success, one conflict');
  } finally {
    for (const url of files) {
      const path = url.replace('/uploads/files/', 'uploads/process-files/').replace('/uploads/images/', 'uploads/images/');
      await unlink(join(process.cwd(), path)).catch(() => undefined);
    }
    await repository('StoredUpload').delete({ scopeKey: In(scopeKeys) });
    await repository('Activity').delete({ orgId: In(orgIds) });
    await repository('Project').delete({ orgId: In(orgIds) });
    await repository('ProjectTemplate').delete({ orgId: In(orgIds) });
    await repository('AuditLog').delete({ orgId: In(orgIds) });
    await repository('User').delete({ id: In(userIds) });
    await repository('Organization').delete({ id: In(orgIds) });
    await database.destroy();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });