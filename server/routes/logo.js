const express = require('express');
const router = express.Router();

const { isSafeUrl } = require('../utils/security');
const axios = require('axios');

router.get('/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  if (!isSafeUrl(url)) {
    return res.status(403).json({ error: 'Forbidden URL destination' });
  }

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 5000,
      maxContentLength: 1024 * 1024 * 5, // 5MB limit
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      }
    });

    const contentType = response.headers['content-type'];
    if (contentType && !contentType.startsWith('image/')) {
        return res.status(400).json({ error: 'Source is not an image' });
    }

    res.set('Content-Type', contentType || 'image/png');
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24h
    res.send(Buffer.from(response.data));
  } catch (err) {
    console.error('Logo proxy error:', err.message);
    res.status(500).json({ error: 'Failed to proxy logo' });
  }
});


module.exports = router;
