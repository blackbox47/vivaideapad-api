import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Idea } from '../ideas/idea.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 3307),
      username: process.env.DB_USERNAME ?? 'vivaidea',
      password: process.env.DB_PASSWORD ?? 'vivaidea',
      database: process.env.DB_NAME ?? 'vivaidea',
      entities: [Idea],
      // Auto-create/alter tables from entities. Fine for prototyping
      // because this DB is local-only and not shared. For multi-developer
      // or production environments, set DB_SYNCHRONIZE=false and use
      // migrations via `pnpm schema:sync` / `pnpm typeorm migration:run`.
      synchronize: (process.env.DB_SYNCHRONIZE ?? 'true') === 'true',
      charset: 'utf8mb4',
      timezone: 'Z',
      logging: ['error', 'warn'],
    }),
  ],
})
export class DatabaseModule {}