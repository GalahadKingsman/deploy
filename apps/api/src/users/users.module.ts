import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { UsersRepository } from './users.repository.js';

@Module({
  providers: [
    {
      provide: UsersRepository,
      useFactory: (pool: Pool) => new UsersRepository(pool),
      inject: [Pool],
    },
  ],
  exports: [UsersRepository],
})
export class UsersModule {}
