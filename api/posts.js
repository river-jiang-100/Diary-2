import { neon } from '@neondatabase/serverless';
import { v2 as cloudinary } from 'cloudinary';

const sql = neon(process.env.DATABASE_URL);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function initTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      text TEXT DEFAULT '',
      imgs TEXT DEFAULT '[]',
      full_date TEXT,
      timestamp TEXT,
      likes INTEGER DEFAULT 0,
      liked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
