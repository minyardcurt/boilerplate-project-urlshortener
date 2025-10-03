require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const dns = require('dns').promises;
const { URL } = require('url');  // explicitly import URL class

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Optional: log every request for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}  Body:`, req.body);
  next();
});

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

const urlSchema = new mongoose.Schema({
  original_url: { type: String, required: true },
  short_url: { type: Number, required: true, unique: true }
});

const Url = mongoose.model('Url', urlSchema);

// Root route
app.get('/', (req, res) => {
  res.send('URL Shortener Microservice is running');
});

// POST endpoint: shorten URL
app.post('/api/shorturl', async (req, res) => {
  // Get URL from body and trim whitespace/newlines
  const originalUrl = (req.body.url || '').trim();

  // Basic check: must exist
  if (!originalUrl) {
    return res.json({ error: 'invalid url' });
  }

  try {
    // Parse the URL to break it down
    const parsed = new URL(originalUrl);

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.json({ error: 'invalid url' });
    }

    // Use only hostname for DNS lookup (no path, query, protocol)
    await dns.lookup(parsed.hostname);

    // Check for existing entry
    const found = await Url.findOne({ original_url: originalUrl });
    if (found) {
      return res.json({
        original_url: found.original_url,
        short_url: found.short_url
      });
    }

    // Generate new short URL id: find max short_url then +1
    const last = await Url.findOne().sort({ short_url: -1 }).exec();
    const nextShort = last ? last.short_url + 1 : 1;

    const newEntry = new Url({
      original_url: originalUrl,
      short_url: nextShort
    });
    await newEntry.save();

    return res.json({
      original_url: newEntry.original_url,
      short_url: newEntry.short_url
    });

  } catch (err) {
    // Any error in parsing, DNS, or DB => invalid url
    console.error('Error processing URL:', err.message);
    return res.json({ error: 'invalid url' });
  }
});

// GET endpoint: redirect
app.get('/api/shorturl/:short_url', async (req, res) => {
  // Trim any whitespace or newline in param
  const raw = req.params.short_url;
  const num = parseInt(raw.trim(), 10);
  console.log('Redirect route hit, short_url:', num);

  if (isNaN(num)) {
    return res.json({ error: 'invalid url' });
  }

  try {
    const found = await Url.findOne({ short_url: num });
    if (!found) {
      return res.json({ error: 'No short URL found' });
    }
    return res.redirect(found.original_url);
  } catch (err) {
    console.error('Error on redirect:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});