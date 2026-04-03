import 'dotenv/config';
import 'reflect-metadata';

import * as path from 'path';

import { DataSource } from 'typeorm';

const isProduction = process.env.NODE_ENV === 'production';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT ?? 5432),
  username: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DBNAME,
  synchronize: false,
  logging: false,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  entities: [path.join(__dirname, '**', '*.entity.js')],
  migrations: [path.join(__dirname, 'migrations', '*.js')],
});
