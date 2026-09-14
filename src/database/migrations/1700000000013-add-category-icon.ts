import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategoryIcon1700000000013 implements MigrationInterface {
  name = 'AddCategoryIcon1700000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const categories = await queryRunner.getTable('categories');
    if (!categories?.findColumnByName('icon')) {
      await queryRunner.query(
        'ALTER TABLE `categories` ADD COLUMN `icon` varchar(255) NULL',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const categories = await queryRunner.getTable('categories');
    if (categories?.findColumnByName('icon')) {
      await queryRunner.query('ALTER TABLE `categories` DROP COLUMN `icon`');
    }
  }
}
