import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentMethodsOnlyBkash1700000000006 implements MigrationInterface {
  name = 'PaymentMethodsOnlyBkash1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The original payment-methods migration seeded Nagad, Rocket, and Bank
    // in addition to bKash. We now only want bKash, so remove the others.
    await queryRunner.query(
      `DELETE FROM \`payment_methods\` WHERE \`code\` IN ('Nagad', 'Rocket', 'Bank')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-insert the original seed rows so a rollback restores prior state.
    await queryRunner.query(
      `INSERT INTO \`payment_methods\` (\`id\`, \`code\`, \`name\`, \`description\`, \`account_hint\`, \`is_active\`, \`sort_order\`) VALUES
      (UUID(), 'Nagad', 'Nagad', 'Nagad digital financial service', NULL, 1, 2),
      (UUID(), 'Rocket', 'Rocket', 'Dutch-Bangla Bank Rocket mobile banking', NULL, 1, 3),
      (UUID(), 'Bank', 'Bank transfer', 'Direct electronic bank wire transfer', NULL, 1, 4)`,
    );
  }
}
