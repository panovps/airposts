import 'dotenv/config';
import { DataSource } from 'typeorm';

import { buildTypeOrmOptions } from './typeorm.config';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not configured');
}

export default new DataSource(buildTypeOrmOptions(databaseUrl));
