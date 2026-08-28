import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renumber user roles to match the new wire encoding:
 *   SUPERADMIN     = 1 (was 3)
 *   ADMINISTRATOR  = 2 (was 1)
 *   CONTRIBUTOR    = 3 (was 2)
 *
 * Permutation: old 1 → 2, old 2 → 3, old 3 → 1.
 *
 * The down() migration reverses it (1→3, 2→1, 3→2) and reverts the column
 * default. Lossy by design — only the numeric codes are swapped, no data
 * is destroyed.
 *
 * NOTE on JWT: existing access/refresh tokens signed before this migration
 * carries the OLD role code in `payload.role`. Those tokens will decode as
 * a different role under the new encoding and authorization will change
 * for the affected users until they re-authenticate. The token TTL is
 * short (15m default) so this self-heals within one window.
 */
export class RenumberUserRoles1700000000002 implements MigrationInterface {
  name = 'RenumberUserRoles1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Three-step permutation to avoid clobbering. We can't do a single
    // UPDATE because 1→2, 2→3, 3→1 is a cycle that would overwrite values
    // mid-flight. Stage through sentinels outside the 1..3 range, then
    // collapse to the new values.
    //
    // Stage A: encode each old value with an offset that survives collisions.
    //   old 1 → 11
    //   old 2 → 22
    //   old 3 → 33
    await queryRunner.query(
      `UPDATE \`users\` SET \`role\` = CASE \`role\` WHEN 1 THEN 11 WHEN 2 THEN 22 WHEN 3 THEN 33 ELSE \`role\` END WHERE \`role\` IN (1, 2, 3)`,
    );
    // Stage B: collapse sentinels to the new codes.
    //   11 → 2 (Administrator)
    //   22 → 3 (Contributor)
    //   33 → 1 (Super Admin)
    await queryRunner.query(
      `UPDATE \`users\` SET \`role\` = CASE \`role\` WHEN 11 THEN 2 WHEN 22 THEN 3 WHEN 33 THEN 1 ELSE \`role\` END WHERE \`role\` IN (11, 22, 33)`,
    );
    // Update the column default to the new CONTRIBUTOR value (3).
    await queryRunner.query(
      `ALTER TABLE \`users\` MODIFY \`role\` tinyint NOT NULL DEFAULT 3`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse permutation: new 1 → 3, new 2 → 1, new 3 → 2.
    await queryRunner.query(
      `UPDATE \`users\` SET \`role\` = CASE \`role\` WHEN 1 THEN 11 WHEN 2 THEN 22 WHEN 3 THEN 33 ELSE \`role\` END WHERE \`role\` IN (1, 2, 3)`,
    );
    await queryRunner.query(
      `UPDATE \`users\` SET \`role\` = CASE \`role\` WHEN 11 THEN 3 WHEN 22 THEN 1 WHEN 33 THEN 2 ELSE \`role\` END WHERE \`role\` IN (11, 22, 33)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` MODIFY \`role\` tinyint NOT NULL DEFAULT 2`,
    );
  }
}
