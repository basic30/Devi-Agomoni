import express from 'express';
import cors from 'cors';
import youtubedl from 'yt-dlp-exec';
import http from 'http';
import https from 'https';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));

// In-memory cache for audio URLs (cached for 3 hours, URLs expire after 6 hours)
const urlCache = new Map();
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

async function getDirectAudioUrl(videoId) {
  const cached = urlCache.get(videoId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.url;
  }

  const url = await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, {
    getUrl: true,
    format: 'bestaudio[ext=m4a]/bestaudio',
    noWarnings: true,
    preferFreeFormats: true,
  });

  const directUrl = url.trim();
  urlCache.set(videoId, { url: directUrl, timestamp: Date.now() });
  return directUrl;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Devi Agomoni Audio Stream Proxy', uptime: process.uptime() });
});

// JSON endpoint returning the direct audio URL and metadata
app.get('/api/info/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!/^[a-zA-Z0-9_-]{10,12}$/.test(videoId)) {
      return res.status(400).json({ error: 'Invalid videoId format' });
    }

    const audioUrl = await getDirectAudioUrl(videoId);
    res.json({ videoId, audioUrl, mimeType: 'audio/mp4' });
  } catch (err) {
    console.error('Info error:', err.message);
    res.status(500).json({ error: 'Failed to extract audio stream', details: err.message });
  }
});

// Primary streaming endpoint with full HTTP Range (seek) support
app.get('/api/stream/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!/^[a-zA-Z0-9_-]{10,12}$/.test(videoId)) {
      return res.status(400).json({ error: 'Invalid videoId format' });
    }

    const directAudioUrl = await getDirectAudioUrl(videoId);

    const clientRange = req.headers.range;
    const requestHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
    if (clientRange) {
      requestHeaders['Range'] = clientRange;
    }

    const parsedUrl = new URL(directAudioUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const proxyReq = client.request(directAudioUrl, { headers: requestHeaders }, (proxyRes) => {
      // Forward status code (200 OK or 206 Partial Content)
      res.status(proxyRes.statusCode);

      // Forward essential audio streaming headers
      const forwardHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag'];
      forwardHeaders.forEach((h) => {
        if (proxyRes.headers[h]) {
          res.setHeader(h, proxyRes.headers[h]);
        }
      });

      // Ensure audio/mp4 content type fallback
      if (!res.getHeader('content-type')) {
        res.setHeader('content-type', 'audio/mp4');
      }

      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('Proxy request error:', err.message);
      // Evict cache on network error so next request refreshes
      urlCache.delete(videoId);
      if (!res.headersSent) res.status(502).json({ error: 'Audio gateway error' });
    });

    req.on('close', () => {
      proxyReq.destroy();
    });

    proxyReq.end();
  } catch (err) {
    console.error('Stream handler error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to process audio stream', details: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Devi Agomoni Audio Stream Proxy] listening on http://0.0.0.0:${PORT}`);
});
