import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetToken1700000000013 implements MigrationInterface {
  name = 'AddPasswordResetToken1700000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` ADD COLUMN `password_reset_token` varchar(128) NULL, ADD COLUMN `password_reset_token_expires_at` datetime NULL, ADD UNIQUE INDEX `uq_users_password_reset_token` (`password_reset_token`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` DROP INDEX `uq_users_password_reset_token`',
    );
    await queryRunner.query(
      'ALTER TABLE `users` DROP COLUMN `password_reset_token_expires_at`',
    );
    await queryRunner.query(
      'ALTER TABLE `users` DROP COLUMN `password_reset_token`',
    );
  }
}
