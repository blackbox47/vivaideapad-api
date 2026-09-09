import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveScheduledAddIsOnboarding1700000000007
  implements MigrationInterface
{
  name = 'RemoveScheduledAddIsOnboarding1700000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Update any existing 'scheduled' rows to 'draft'
    await queryRunner.query(
      `UPDATE \`concepts\` SET \`status\` = 'draft' WHERE \`status\` = 'scheduled'`,
    );

    // 2. Modify status enum to ('draft', 'active', 'archived')
    await queryRunner.query(
      `ALTER TABLE \`concepts\` MODIFY COLUMN \`status\` enum ('draft', 'active', 'archived') NOT NULL DEFAULT 'draft'`,
    );

    // 3. Add is_onboarding column
    await queryRunner.query(
      `ALTER TABLE \`concepts\` ADD COLUMN \`is_onboarding\` tinyint(1) NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop is_onboarding column
    await queryRunner.query(
      `ALTER TABLE \`concepts\` DROP COLUMN \`is_onboarding\``,
    );

    // 2. Revert status enum back to include 'scheduled'
    await queryRunner.query(
      `ALTER TABLE \`concepts\` MODIFY COLUMN \`status\` enum ('draft', 'scheduled', 'active', 'archived') NOT NULL DEFAULT 'draft'`,
    );
  }
}
