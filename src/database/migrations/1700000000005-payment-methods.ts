import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentMethods1700000000005 implements MigrationInterface {
  name = 'PaymentMethods1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`payment_methods\` (
        \`id\` varchar(36) NOT NULL,
        \`code\` varchar(50) NOT NULL,
        \`name\` varchar(120) NOT NULL,
        \`description\` text NULL,
        \`icon\` varchar(512) NULL,
        \`is_active\` tinyint NOT NULL DEFAULT 1,
        \`sort_order\` int NOT NULL DEFAULT 0,
        \`account_hint\` varchar(120) NULL,
        \`metadata\` json NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` datetime(6) NULL,
        INDEX \`idx_payment_methods_is_active\` (\`is_active\`),
        UNIQUE INDEX \`idx_payment_methods_code\` (\`code\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );

    // Seed initial payment methods
    await queryRunner.query(
      `INSERT INTO \`payment_methods\` (\`id\`, \`code\`, \`name\`, \`description\`, \`account_hint\`, \`is_active\`, \`sort_order\`) VALUES
      (UUID(), 'bKash', 'bKash', 'bKash mobile financial service', '018•••42', 1, 1),
      (UUID(), 'Nagad', 'Nagad', 'Nagad digital financial service', NULL, 1, 2),
      (UUID(), 'Rocket', 'Rocket', 'Dutch-Bangla Bank Rocket mobile banking', NULL, 1, 3),
      (UUID(), 'Bank', 'Bank transfer', 'Direct electronic bank wire transfer', NULL, 1, 4)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`idx_payment_methods_code\` ON \`payment_methods\``,
    );
    await queryRunner.query(
      `DROP INDEX \`idx_payment_methods_is_active\` ON \`payment_methods\``,
    );
    await queryRunner.query(`DROP TABLE \`payment_methods\``);
  }
}
