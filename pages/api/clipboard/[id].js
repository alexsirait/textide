import { promises as fs } from 'fs';
import path from 'path';

const CLIPBOARD_FILE = path.join(process.cwd(), 'data', 'clipboard.json');

// Helper function to read clipboard data
async function readClipboardData() {
  try {
    const data = await fs.readFile(CLIPBOARD_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Helper to get unique identifier from request
function getVisitorId(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];
  return Buffer.from(`${ip}-${userAgent}`).toString('base64');
}

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const clipboards = await readClipboardData();
    const item = clipboards.find(item => item.id === id);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Add hasLiked field for the current visitor
    const visitorId = getVisitorId(req);
    const enrichedItem = {
      ...item,
      hasLiked: item.likes?.includes(visitorId) || false,
    };

    return res.status(200).json(enrichedItem);
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
