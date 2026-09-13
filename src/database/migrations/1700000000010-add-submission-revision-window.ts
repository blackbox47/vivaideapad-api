import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubmissionRevisionWindow1700000000010
  implements MigrationInterface
{
  name = 'AddSubmissionRevisionWindow1700000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const submissions = await queryRunner.getTable('submissions');
    if (!submissions?.findColumnByName('revision_window_days')) {
      await queryRunner.query(
        'ALTER TABLE `submissions` ADD COLUMN `revision_window_days` int NULL',
      );
    }
    if (!submissions?.findColumnByName('revision_due_at')) {
      await queryRunner.query(
        'ALTER TABLE `submissions` ADD COLUMN `revision_due_at` datetime NULL',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const submissions = await queryRunner.getTable('submissions');
    if (submissions?.findColumnByName('revision_due_at')) {
      await queryRunner.query(
        'ALTER TABLE `submissions` DROP COLUMN `revision_due_at`',
      );
    }
    if (submissions?.findColumnByName('revision_window_days')) {
      await queryRunner.query(
        'ALTER TABLE `submissions` DROP COLUMN `revision_window_days`',
      );
    }
  }
}
