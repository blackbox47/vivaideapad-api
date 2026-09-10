import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVerificationToken1700000000009 implements MigrationInterface {
  name = 'AddVerificationToken1700000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` ADD COLUMN `verification_token` varchar(128) NULL, ADD COLUMN `verification_token_expires_at` datetime NULL, ADD UNIQUE INDEX `uq_users_verification_token` (`verification_token`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` DROP INDEX `uq_users_verification_token`',
    );
    await queryRunner.query(
      'ALTER TABLE `users` DROP COLUMN `verification_token_expires_at`',
    );
    await queryRunner.query(
      'ALTER TABLE `users` DROP COLUMN `verification_token`',
    );
  }
}
