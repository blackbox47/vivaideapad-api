import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubmissionSubmittedNotificationType1700000000012
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`notifications\`
        MODIFY COLUMN \`type\` enum(
          'application_decision',
          'submission_decision',
          'submission_request_revision',
          'submission_submitted',
          'payout_status_changed',
          'payout_decision',
          'access_status_changed',
          'broadcast',
          'system'
        ) NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove any rows with the new type before shrinking the enum.
    await queryRunner.query(`
      DELETE FROM \`notifications\` WHERE \`type\` = 'submission_submitted'
    `);
    await queryRunner.query(`
      ALTER TABLE \`notifications\`
        MODIFY COLUMN \`type\` enum(
          'application_decision',
          'submission_decision',
          'submission_request_revision',
          'payout_status_changed',
          'payout_decision',
          'access_status_changed',
          'broadcast',
          'system'
        ) NOT NULL
    `);
  }
}
