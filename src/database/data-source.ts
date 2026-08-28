import 'reflect-metadata';
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3307),
  username: process.env.DB_USERNAME ?? 'vivaidea',
  password: process.env.DB_PASSWORD ?? 'vivaidea',
  database: process.env.DB_NAME ?? 'vivaidea',
  entities: [__dirname + '/../**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  charset: 'utf8mb4',
  timezone: 'Z',
});
