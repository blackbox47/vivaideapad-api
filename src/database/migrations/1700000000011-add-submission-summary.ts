import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubmissionSummary1700000000011 implements MigrationInterface {
  name = 'AddSubmissionSummary1700000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const submissions = await queryRunner.getTable('submissions');
    if (!submissions?.findColumnByName('summary')) {
      await queryRunner.query(
        'ALTER TABLE `submissions` ADD COLUMN `summary` varchar(240) NULL',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const submissions = await queryRunner.getTable('submissions');
    if (submissions?.findColumnByName('summary')) {
      await queryRunner.query(
        'ALTER TABLE `submissions` DROP COLUMN `summary`',
      );
    }
  }
}
