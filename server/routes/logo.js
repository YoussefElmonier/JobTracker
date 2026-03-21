const express = require('express');
const router = express.Router();

router.get('/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) throw new Error(`Source returned ${response.status}`);

    const contentType = response.headers.get('Content-Type');
    const buffer = await response.arrayBuffer();

    res.set('Content-Type', contentType || 'image/png');
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24h
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Logo proxy error:', err.message);
    res.status(500).json({ error: 'Failed to proxy logo' });
  }
});

module.exports = router;
