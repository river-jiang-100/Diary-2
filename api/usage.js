import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    let totalBytes = 0;
    let totalCount = 0;
    let nextCursor = null;

    do {
      const params = { type: 'upload', prefix: 'love-diary', max_results: 500 };
      if (nextCursor) params.next_cursor = nextCursor;
      const result = await cloudinary.api.resources(params);
      result.resources.forEach(r => { totalBytes += r.bytes || 0; });
      totalCount += result.resources.length;
      nextCursor = result.next_cursor;
    } while (nextCursor);

    const usedMB = (totalBytes / 1024 / 1024).toFixed(1);
    const limitGB = 25;
    const usedPct = (totalBytes / (limitGB * 1024 * 1024 * 1024) * 100).toFixed(2);

    return res.status(200).json({ usedMB, limitGB, usedPct, totalCount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
