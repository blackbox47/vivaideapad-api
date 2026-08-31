import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a `family` column to `refresh_tokens` so we can detect reuse of a
 * rotated refresh token. Every refresh token issued during a single sign-in
 * session belongs to one family; the family id is preserved across rotations
 * and a new family is started on each fresh sign-in.
 *
 * Reuse detection: when a token is presented, if its row is already revoked
 * (or its hash no longer matches), we revoke every token in the same family
 * — forcing re-authentication and cutting off an attacker who replayed a
 * stolen but already-rotated token.
 *
 * NOTE: existing rows have no family. We backfill each existing row with
 * its own unique family id so the index is non-null and reuse detection
 * still scopes correctly per-token after this migration runs.
 */
export class RefreshTokenFamily1700000000003 implements MigrationInterface {
  name = 'RefreshTokenFamily1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` ADD \`family\` varchar(36) NULL AFTER \`user_id\``,
    );
    // Backfill: every existing row becomes its own single-token family.
    await queryRunner.query(
      `UPDATE \`refresh_tokens\` SET \`family\` = \`id\` WHERE \`family\` IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` MODIFY \`family\` varchar(36) NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX \`idx_rt_family\` ON \`refresh_tokens\` (\`family\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`idx_rt_family\` ON \`refresh_tokens\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` DROP COLUMN \`family\``,
    );
  }
}
