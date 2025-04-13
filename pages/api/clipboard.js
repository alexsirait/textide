import { promises as fs } from 'fs';
import path from 'path';

const CLIPBOARD_FILE = path.join(process.cwd(), 'data', 'clipboard.json');
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// Helper function to generate short ID
function generateShortId() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// Helper function to read clipboard data
async function readClipboardData() {
  try {
    const data = await fs.readFile(CLIPBOARD_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading file:', error);
    // If file doesn't exist, return empty array
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

// Helper function to write clipboard data
async function writeClipboardData(data) {
  try {
    // Ensure the data directory exists
    const dir = path.dirname(CLIPBOARD_FILE);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(CLIPBOARD_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing file:', error);
    throw new Error('Failed to write data');
  }
}

// Helper function to clean expired items
async function cleanExpiredItems(clipboards) {
  const now = Date.now();
  return clipboards.filter(item => {
    const createdAt = new Date(item.createdAt).getTime();
    return (now - createdAt) < THIRTY_DAYS_MS;
  });
}

// Helper to get unique identifier from request
function getVisitorId(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];
  return Buffer.from(`${ip}-${userAgent}`).toString('base64');
}

export default async function handler(req, res) {
  try {
    let clipboards = await readClipboardData();
    
    // Clean expired items on every request
    clipboards = await cleanExpiredItems(clipboards);
    
    const visitorId = getVisitorId(req);

    switch (req.method) {
      case 'GET': {
        // Add hasLiked field for each item
        const enrichedClipboards = clipboards.map(item => ({
          ...item,
          hasLiked: item.likes?.includes(visitorId) || false,
          editable: item.creatorId === visitorId || item.editable === true,
        }));
        return res.status(200).json(enrichedClipboards);
      }

      case 'POST': {
        const { text, editable = false } = req.body;
        
        if (!text || typeof text !== 'string' || !text.trim()) {
          return res.status(400).json({ error: 'Valid text is required' });
        }

        // Generate a unique short ID
        let id;
        do {
          id = generateShortId();
        } while (clipboards.some(item => item.id === id));

        const newItem = {
          id,
          text: text.trim(),
          createdAt: new Date().toISOString(),
          likes: [],
          likesCount: 0,
          creatorId: visitorId,
          editable: editable === true,
        };

        clipboards.unshift(newItem);
        await writeClipboardData(clipboards);

        return res.status(201).json({
          ...newItem,
          hasLiked: false,
          editable: true,
        });
      }

      case 'PUT': {
        const { id, text } = req.body;
        if (!id || !text || typeof text !== 'string' || !text.trim()) {
          return res.status(400).json({ error: 'Valid ID and text are required' });
        }

        const itemIndex = clipboards.findIndex(item => item.id === id);
        if (itemIndex === -1) {
          return res.status(404).json({ error: 'Item not found' });
        }

        // Check if the visitor is the creator or item is editable
        const canEdit = clipboards[itemIndex].creatorId === visitorId || 
                       clipboards[itemIndex].editable === true;
                       
        if (!canEdit) {
          return res.status(403).json({ error: 'Not authorized to edit this item' });
        }

        clipboards[itemIndex] = {
          ...clipboards[itemIndex],
          text: text.trim(),
          updatedAt: new Date().toISOString(),
        };

        await writeClipboardData(clipboards);

        return res.status(200).json({
          ...clipboards[itemIndex],
          hasLiked: clipboards[itemIndex].likes?.includes(visitorId) || false,
          editable: true,
        });
      }

      case 'PATCH': {
        const { id, action } = req.body;
        if (!id || action !== 'like') {
          return res.status(400).json({ error: 'Invalid request' });
        }

        const itemIndex = clipboards.findIndex(item => item.id === id);
        if (itemIndex === -1) {
          return res.status(404).json({ error: 'Item not found' });
        }

        const likes = clipboards[itemIndex].likes || [];
        const hasLiked = likes.includes(visitorId);

        if (hasLiked) {
          // Unlike
          clipboards[itemIndex].likes = likes.filter(id => id !== visitorId);
        } else {
          // Like
          clipboards[itemIndex].likes = [...likes, visitorId];
        }

        clipboards[itemIndex].likesCount = clipboards[itemIndex].likes.length;
        await writeClipboardData(clipboards);

        return res.status(200).json({
          hasLiked: !hasLiked,
          likesCount: clipboards[itemIndex].likesCount,
        });
      }

      case 'DELETE': {
        const { id } = req.body;
        const filteredData = clipboards.filter((item) => item.id !== id);
        await writeClipboardData(filteredData);
        return res.status(200).json({ message: 'Deleted' });
      }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('Clipboard API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}