import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../modules/users/entities/user.entity';
import { Request } from '../modules/requests/entities/request.entity';
import { AuditLog } from '../modules/audit/entities/audit.entity';
import * as path from 'path';

const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'sqlite',
  database: process.env.DB_DATABASE || './data/database.sqlite',
  entities: [User, Request, AuditLog],
  migrations: [path.join(__dirname, '../database/migrations/*.{js,ts}')],
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
});

export default databaseConfig;
