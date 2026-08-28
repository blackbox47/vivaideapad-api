import { MigrationInterface, QueryRunner } from 'typeorm';

export class Baseline1700000000000 implements MigrationInterface {
  name = 'Baseline1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`users\` (\`id\` varchar(36) NOT NULL, \`email\` varchar(255) NOT NULL, \`password_hash\` varchar(255) NOT NULL, \`display_name\` varchar(120) NULL, \`bio\` text NULL, \`avatar_url\` varchar(512) NULL, \`role\` enum ('administrator', 'reviewer', 'contributor', 'public') NOT NULL DEFAULT 'contributor', \`access_status\` enum ('active', 'invited', 'suspended', 'pending_review') NOT NULL DEFAULT 'invited', \`display_prefs\` json NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL, INDEX \`idx_users_role\` (\`role\`), UNIQUE INDEX \`idx_users_email\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`wallet_ledger_entries\` (\`id\` varchar(36) NOT NULL, \`user_id\` varchar(36) NOT NULL, \`type\` enum ('reward_credit', 'payout_hold', 'payout_reversal', 'manual_adjustment', 'fee') NOT NULL, \`amount\` decimal(14,2) NOT NULL, \`status\` enum ('pending', 'posted', 'reversed') NOT NULL DEFAULT 'posted', \`reference\` varchar(120) NOT NULL, \`metadata\` json NULL, \`posted_at\` datetime NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_ledger_status\` (\`status\`), INDEX \`idx_ledger_reference\` (\`reference\`), INDEX \`idx_ledger_user\` (\`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`submissions\` (\`id\` varchar(36) NOT NULL, \`user_id\` varchar(36) NOT NULL, \`concept_id\` varchar(36) NOT NULL, \`title\` varchar(255) NOT NULL, \`body\` text NOT NULL, \`attachments\` json NULL, \`status\` enum ('draft', 'pending_review', 'changes_requested', 'approved', 'rejected') NOT NULL DEFAULT 'draft', \`risk_signal\` json NULL, \`reward_amount\` decimal(14,2) NULL, \`decision_notes\` text NULL, \`decided_at\` datetime NULL, \`decided_by\` varchar(36) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL, INDEX \`idx_submissions_status\` (\`status\`), INDEX \`idx_submissions_concept\` (\`concept_id\`), INDEX \`idx_submissions_user\` (\`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`refresh_tokens\` (\`id\` varchar(36) NOT NULL, \`user_id\` varchar(36) NOT NULL, \`token_hash\` varchar(255) NOT NULL, \`expires_at\` datetime NOT NULL, \`revoked_at\` datetime NULL, \`ua\` varchar(64) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_rt_user\` (\`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`payout_requests\` (\`id\` varchar(36) NOT NULL, \`user_id\` varchar(36) NOT NULL, \`amount\` decimal(14,2) NOT NULL, \`status\` enum ('pending', 'paid', 'rejected') NOT NULL DEFAULT 'pending', \`method\` varchar(255) NULL, \`details\` json NULL, \`decision_notes\` text NULL, \`processing_reference\` varchar(255) NULL, \`processed_at\` datetime NULL, \`processed_by\` varchar(36) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL, INDEX \`idx_payout_created\` (\`created_at\`), INDEX \`idx_payout_status\` (\`status\`), INDEX \`idx_payout_user\` (\`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`notifications\` (\`id\` varchar(36) NOT NULL, \`recipient_id\` varchar(36) NOT NULL, \`type\` enum ('application_decision', 'submission_decision', 'submission_request_revision', 'payout_status_changed', 'payout_decision', 'access_status_changed', 'broadcast', 'system') NOT NULL, \`title\` varchar(255) NOT NULL, \`body\` text NULL, \`payload\` json NULL, \`linked_record_type\` varchar(60) NULL, \`linked_record_id\` varchar(36) NULL, \`read_state\` enum ('unread', 'read') NOT NULL DEFAULT 'unread', \`read_at\` datetime NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL, INDEX \`idx_notifications_type\` (\`type\`), INDEX \`idx_notifications_read\` (\`recipient_id\`, \`read_state\`), INDEX \`idx_notifications_recipient\` (\`recipient_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`leaderboard_records\` (\`id\` varchar(36) NOT NULL, \`user_id\` varchar(36) NOT NULL, \`period\` enum ('all_time', 'monthly', 'weekly') NOT NULL, \`score\` decimal(14,2) NOT NULL DEFAULT '0.00', \`submissions_count\` int NOT NULL DEFAULT '0', \`approvals\` int NOT NULL DEFAULT '0', \`streak\` int NOT NULL DEFAULT '0', \`last_updated\` datetime NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_leaderboard_period_score\` (\`period\`, \`score\`), UNIQUE INDEX \`uq_leaderboard_user_period\` (\`user_id\`, \`period\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`concepts\` (\`id\` varchar(36) NOT NULL, \`category_id\` varchar(36) NOT NULL, \`title\` varchar(255) NOT NULL, \`brief\` text NOT NULL, \`reward_budget\` decimal(14,2) NOT NULL DEFAULT '0.00', \`status\` enum ('draft', 'published', 'closed') NOT NULL DEFAULT 'draft', \`metadata\` json NULL, \`open_date\` datetime NULL, \`close_date\` datetime NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL, INDEX \`idx_concepts_category\` (\`category_id\`), INDEX \`idx_concepts_status\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`categories\` (\`id\` varchar(36) NOT NULL, \`slug\` varchar(120) NOT NULL, \`name\` varchar(255) NOT NULL, \`description\` text NULL, \`is_active\` varchar(16) NOT NULL DEFAULT 'active', \`sort_order\` int NOT NULL DEFAULT '0', \`color\` varchar(16) NOT NULL DEFAULT '#6B7280', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL, INDEX \`idx_categories_is_active\` (\`is_active\`), UNIQUE INDEX \`idx_categories_slug\` (\`slug\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`audit_events\` (\`id\` varchar(36) NOT NULL, \`actor_id\` varchar(36) NOT NULL, \`action\` varchar(120) NOT NULL, \`target_type\` varchar(60) NOT NULL, \`target_id\` varchar(36) NOT NULL, \`category\` varchar(60) NULL, \`context\` json NULL, \`occurred_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_audit_occurred\` (\`occurred_at\`), INDEX \`idx_audit_action\` (\`action\`), INDEX \`idx_audit_target\` (\`target_type\`, \`target_id\`), INDEX \`idx_audit_actor\` (\`actor_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`applications\` (\`id\` varchar(36) NOT NULL, \`user_id\` varchar(36) NOT NULL, \`category_id\` varchar(36) NOT NULL, \`idea_title\` varchar(255) NOT NULL, \`idea_description\` text NOT NULL, \`attachments\` json NULL, \`status\` enum ('submitted', 'approved_invited', 'rejected', 'needs_info', 'withdrawn') NOT NULL DEFAULT 'submitted', \`decision_notes\` text NULL, \`decided_at\` datetime NULL, \`decided_by\` varchar(36) NULL, \`reference_number\` varchar(64) NULL, \`consent\` tinyint NOT NULL DEFAULT '0', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL, INDEX \`idx_applications_status\` (\`status\`), INDEX \`idx_applications_category\` (\`category_id\`), INDEX \`idx_applications_user\` (\`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`idx_applications_user\` ON \`applications\``,
    );
    await queryRunner.query(
      `DROP INDEX \`idx_applications_category\` ON \`applications\``,
    );
    await queryRunner.query(
      `DROP INDEX \`idx_applications_status\` ON \`applications\``,
    );
    await queryRunner.query(`DROP TABLE \`applications\``);
    await queryRunner.query(
      `DROP INDEX \`idx_audit_actor\` ON \`audit_events\``,
    );
    await queryRunner.query(
      `DROP INDEX \`idx_audit_target\` ON \`audit_events\``,
    );
    await queryRunner.query(
      `DROP INDEX \`idx_audit_action\` ON \`audit_events\``,
    );
    await queryRunner.query(
      `DROP INDEX \`idx_audit_occurred\` ON \`audit_events\``,
    );
    await queryRunner.query(`DROP TABLE \`audit_events\``);
    await queryRunner.query(
      `DROP INDEX \`idx_categories_slug\` ON \`categories\``,
    );
    await queryRunner.query(
      `DROP INDEX \`idx_categories_is_active\` ON \`categories\``,
    );
    await queryRunner.query(`DROP TABLE \`categories\``);
    await queryRunner.query(
      `DROP INDEX \`idx_concepts_status\` ON \`concepts\``,
    );
    await queryRunner.query(
      `DROP INDEX \`idx_concepts_category\` ON \`concepts\``,
    );
    await queryRunner.query(`DROP TABLE \`concepts\``);
    await queryRunner.query(
      `DROP INDEX \`uq_leaderboard_user_period\` ON \`leaderboard_records\``,
    );
    await queryRunner.query(
      `DROP INDEX \`idx_leaderboard_period_score\` ON \`leaderboard_records\``,
    );
    await queryRunner.query(`DROP TABLE \`leaderboard_records\``);
    await queryRunner.query(
      `DROP INDEX \`idx_notifications_recipient\` ON \`notifications\``,
    );
    await queryRunner.query(
      `DROP INDEX \`idx_notifications_read\` ON \`notifications\``,
    );
    await queryRunner.query(
      `DROP INDEX \`idx_notifications_type\` ON \`notifications\``,
    );
    await queryRunner.query(`DROP TABLE \`notifications\``);
    await queryRunner.query(
      `DROP INDEX \`idx_payout_user\` ON \`payout_requests\``,
    );
    await queryRunner.query(
      `DROP INDEX \`idx_payout_status\` ON \`payout_requests\``,
    );
    await queryRunner.query(
      `DROP INDEX \`idx_payout_created\` ON \`payout_requests\``,
    );
    await queryRunner.query(`DROP TABLE \`payout_requests\``);
    await queryRunner.query(`DROP INDEX \`idx_rt_user\` ON \`refresh_tokens\``);
    await queryRunner.query(`DROP TABLE \`refresh_tokens\``);
    await queryRunner.query(
      `DROP INDEX \`idx_submissions_user\` ON \`submissions\``,
    );
    await queryRunner.query(
      `DROP INDEX \`idx_submissions_concept\` ON \`submissions\``,
    );
    await queryRunner.query(
      `DROP INDEX \`idx_submissions_status\` ON \`submissions\``,
    );
    await queryRunner.query(`DROP TABLE \`submissions\``);
    await queryRunner.query(
      `DROP INDEX \`idx_ledger_user\` ON \`wallet_ledger_entries\``,
    );
    await queryRunner.query(
      `DROP INDEX \`idx_ledger_reference\` ON \`wallet_ledger_entries\``,
    );
    await queryRunner.query(
      `DROP INDEX \`idx_ledger_status\` ON \`wallet_ledger_entries\``,
    );
    await queryRunner.query(`DROP TABLE \`wallet_ledger_entries\``);
    await queryRunner.query(`DROP INDEX \`idx_users_email\` ON \`users\``);
    await queryRunner.query(`DROP INDEX \`idx_users_role\` ON \`users\``);
    await queryRunner.query(`DROP TABLE \`users\``);
  }
}
