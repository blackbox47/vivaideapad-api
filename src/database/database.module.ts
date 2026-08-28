import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

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
      autoLoadEntities: true,
      // Schema is owned by migrations. Set DB_SYNCHRONIZE=true only in
      // throwaway dev sandboxes; the real dev/prod workflow is
      // `pnpm migration:run`.
      synchronize: (process.env.DB_SYNCHRONIZE ?? 'false') === 'true',
      charset: 'utf8mb4',
      timezone: 'Z',
      logging: ['error', 'warn'],
    }),
  ],
})
export class DatabaseModule {}
