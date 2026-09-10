import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoogleIdToUsers1700000000008 implements MigrationInterface {
  name = 'AddGoogleIdToUsers1700000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add google_id column and unique index
    await queryRunner.query(
      'ALTER TABLE `users` ADD COLUMN `google_id` varchar(255) NULL, ADD UNIQUE INDEX `idx_users_google_id` (`google_id`)',
    );

    // 2. Make password_hash nullable so Google-only users can exist
    await queryRunner.query(
      'ALTER TABLE `users` MODIFY COLUMN `password_hash` varchar(255) NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Revert password_hash back to NOT NULL.
    // NOTE: This will fail if any user rows have password_hash = NULL.
    await queryRunner.query(
      'ALTER TABLE `users` MODIFY COLUMN `password_hash` varchar(255) NOT NULL',
    );

    // 2. Drop unique index and google_id column
    await queryRunner.query(
      'ALTER TABLE `users` DROP INDEX `idx_users_google_id`',
    );
    await queryRunner.query('ALTER TABLE `users` DROP COLUMN `google_id`');
  }
}
