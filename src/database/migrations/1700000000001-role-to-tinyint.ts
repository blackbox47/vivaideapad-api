import { MigrationInterface, QueryRunner } from 'typeorm';

export class RoleToTinyint1700000000001 implements MigrationInterface {
  name = 'RoleToTinyint1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Map existing string values to numeric values.
    // reviewer + public both collapse into contributor (2) because both
    // legacy values no longer have a distinct identity in the new enum.
    await queryRunner.query(
      `UPDATE \`users\` SET \`role\` = CASE \`role\` WHEN 'administrator' THEN 1 WHEN 'contributor' THEN 2 WHEN 'public' THEN 2 ELSE 2 END WHERE \`role\` IN ('administrator','reviewer','contributor','public')`,
    );
    // Coerce the column type + tighten the default.
    await queryRunner.query(
      `ALTER TABLE \`users\` MODIFY \`role\` tinyint NOT NULL DEFAULT 2`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` MODIFY \`role\` enum('administrator','reviewer','contributor','public') NOT NULL DEFAULT 'contributor'`,
    );
    // Collapse superadmin (3) → administrator on the way back (lossy).
    await queryRunner.query(
      `UPDATE \`users\` SET \`role\` = CASE \`role\` WHEN 1 THEN 'administrator' WHEN 2 THEN 'contributor' WHEN 3 THEN 'administrator' ELSE 'contributor' END`,
    );
  }
}
