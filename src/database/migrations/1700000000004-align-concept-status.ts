import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignConceptStatus1700000000004 implements MigrationInterface {
  name = 'AlignConceptStatus1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Temporarily change column to varchar to allow existing and new values
    await queryRunner.query(
      `ALTER TABLE \`concepts\` MODIFY COLUMN \`status\` varchar(32) NOT NULL DEFAULT 'draft'`,
    );

    // 2. Migrate existing records: published -> active, closed -> archived
    await queryRunner.query(
      `UPDATE \`concepts\` SET \`status\` = 'active' WHERE \`status\` = 'published'`,
    );
    await queryRunner.query(
      `UPDATE \`concepts\` SET \`status\` = 'archived' WHERE \`status\` = 'closed'`,
    );

    // 3. Apply the aligned enum ('draft', 'scheduled', 'active', 'archived')
    await queryRunner.query(
      `ALTER TABLE \`concepts\` MODIFY COLUMN \`status\` enum ('draft', 'scheduled', 'active', 'archived') NOT NULL DEFAULT 'draft'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`concepts\` MODIFY COLUMN \`status\` varchar(32) NOT NULL DEFAULT 'draft'`,
    );
    await queryRunner.query(
      `UPDATE \`concepts\` SET \`status\` = 'published' WHERE \`status\` = 'active'`,
    );
    await queryRunner.query(
      `UPDATE \`concepts\` SET \`status\` = 'closed' WHERE \`status\` = 'archived'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`concepts\` MODIFY COLUMN \`status\` enum ('draft', 'published', 'closed') NOT NULL DEFAULT 'draft'`,
    );
  }
}
