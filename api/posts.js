import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// 初始化資料表
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

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await initTable();

    // GET - 取得所有貼文
    if (req.method === 'GET') {
      const posts = await sql`
        SELECT * FROM posts ORDER BY timestamp DESC
      `;
      return res.status(200).json(posts);
    }

    // POST - 新增貼文
    if (req.method === 'POST') {
      const { text, imgs, full_date, timestamp } = req.body;
      const result = await sql`
        INSERT INTO posts (text, imgs, full_date, timestamp, likes, liked)
        VALUES (${text || ''}, ${JSON.stringify(imgs || [])}, ${full_date}, ${timestamp}, 0, false)
        RETURNING *
      `;
      return res.status(201).json(result[0]);
    }

    // DELETE - 刪除貼文
    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM posts WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    // PATCH - 更新按讚
    if (req.method === 'PATCH') {
      const { id } = req.query;
      const { likes, liked } = req.body;
      const result = await sql`
        UPDATE posts SET likes = ${likes}, liked = ${liked}
        WHERE id = ${id} RETURNING *
      `;
      return res.status(200).json(result[0]);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
