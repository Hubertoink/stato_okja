import { MigrationInterface, QueryRunner } from 'typeorm';

/** Removes gaps left by draft-round deletions in existing survey series. */
export class RenumberSurveyRounds20260729100000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('surveys'))) return;
    const table = await queryRunner.getTable('surveys');
    if (
      !table?.columns.some((column) => column.name === 'seriesId') ||
      !table.columns.some((column) => column.name === 'roundNumber')
    )
      return;

    const rounds = (await queryRunner.query(
      'SELECT "id", "seriesId", "roundNumber" FROM "surveys" ORDER BY "seriesId" ASC, "roundNumber" ASC',
    )) as Array<{ id: string; seriesId: string; roundNumber: number }>;
    const databaseType = String((queryRunner.dataSource.options as { type?: unknown }).type || '');
    const placeholder = databaseType === 'postgres' ? ['$1', '$2'] : ['?', '?'];
    let seriesId: string | null = null;
    let expectedRoundNumber = 0;

    for (const round of rounds) {
      if (round.seriesId !== seriesId) {
        seriesId = round.seriesId;
        expectedRoundNumber = 1;
      } else {
        expectedRoundNumber += 1;
      }
      if (round.roundNumber === expectedRoundNumber) continue;
      // Values only move downward, so ascending updates keep the unique
      // (seriesId, roundNumber) index valid throughout the migration.
      await queryRunner.query(
        `UPDATE "surveys" SET "roundNumber" = ${placeholder[0]} WHERE "id" = ${placeholder[1]}`,
        [expectedRoundNumber, round.id],
      );
    }
  }

  async down(): Promise<void> {
    // A compact, chronological sequence is the desired permanent state.
  }
}
