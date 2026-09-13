import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

// CLI entry (migrations/seed) does not boot Nest ConfigModule, so load `.env` here.
loadEnv();

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USERNAME ?? 'vivaidea',
  password: process.env.DB_PASSWORD ?? 'vivaidea',
  database: process.env.DB_NAME ?? 'vivaidea',
  entities: [__dirname + '/../**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  charset: 'utf8mb4',
  // Match Nest DatabaseModule — DATETIME columns are Bangladesh local (+06:00).
  timezone: '+06:00',
});
