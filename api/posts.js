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
}

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function uploadToCloudinary(base64Str) {
  const result = await cloudinary.uploader.upload(base64Str, {
    folder: 'love-diary',
    resource_type: 'image',
  });
  return result.secure_url;
}

export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await initTable();

    if (req.method === 'GET') {
      const posts = await sql`SELECT * FROM posts ORDER BY timestamp DESC`;
      return res.status(200).json(posts);
    }

    if (req.method === 'POST') {
      const { text, imgs, full_date, timestamp } = req.body;
      let imgUrls = [];
      if (imgs && imgs.length > 0) {
        imgUrls = await Promise.all(
          imgs.map(async (img) => {
            if (img.startsWith('http')) return img;
            return await uploadToCloudinary(img);
          })
        );
      }
      const result = await sql`
        INSERT INTO posts (text, imgs, full_date, timestamp, likes, liked)
        VALUES (${text || ''}, ${JSON.stringify(imgUrls)}, ${full_date}, ${timestamp}, 0, false)
        RETURNING *
      `;
      return res.status(201).json(result[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM posts WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'PATCH') {
      const { id } = req.query;
      const body = req.body;

      if (body.update_content) {
        const { text, imgs } = body;
        let imgUrls = [];
        if (imgs && imgs.length > 0) {
          imgUrls = await Promise.all(
            imgs.map(async (img) => {
              if (img.startsWith('http')) return img;
              return await uploadToCloudinary(img);
            })
          );
        }
        const result = await sql`
          UPDATE posts SET text = ${text || ''}, imgs = ${JSON.stringify(imgUrls)}
          WHERE id = ${id} RETURNING *
        `;
        return res.status(200).json(result[0]);
      } else {
        const { likes, liked } = body;
        const result = await sql`
          UPDATE posts SET likes = ${likes}, liked = ${liked}
          WHERE id = ${id} RETURNING *
        `;
        return res.status(200).json(result[0]);
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
