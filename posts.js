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
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      date TEXT,
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
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await initTable();
    const { action } = req.query;

    // ── 留言 API ──────────────────────────────────────────────
    if (action === 'comments') {
      const { post_id } = req.query;

      // GET 留言
      if (req.method === 'GET') {
        const rows = await sql`
          SELECT * FROM comments WHERE post_id = ${post_id} ORDER BY created_at ASC
        `;
        return res.status(200).json(rows);
      }

      // POST 新增留言
      if (req.method === 'POST') {
        const { text, date } = req.body;
        const result = await sql`
          INSERT INTO comments (post_id, text, date)
          VALUES (${post_id}, ${text}, ${date}) RETURNING *
        `;
        return res.status(201).json(result[0]);
      }

      // DELETE 刪除留言
      if (req.method === 'DELETE') {
        const { comment_id } = req.query;
        await sql`DELETE FROM comments WHERE id = ${comment_id}`;
        return res.status(200).json({ success: true });
      }
    }

    // ── 貼文 API ──────────────────────────────────────────────
    if (req.method === 'GET') {
      const posts = await sql`SELECT * FROM posts ORDER BY timestamp DESC`;
      // 附加每篇貼文的留言數
      const counts = await sql`
        SELECT post_id, COUNT(*) as cnt FROM comments GROUP BY post_id
      `;
      const countMap = {};
      counts.forEach(r => { countMap[r.post_id] = parseInt(r.cnt); });
      const result = posts.map(p => ({ ...p, comment_count: countMap[p.id] || 0 }));
      return res.status(200).json(result);
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
