// Load environment variables
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const dns = require('dns').promises;

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Request logging (optional, useful for debugging)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Mongoose Schema & Model
const urlSchema = new mongoose.Schema({
  original_url: { type: String, required: true },
  short_url: { type: Number, required: true, unique: true }
});

const Url = mongoose.model('Url', urlSchema);

// Root Route
app.get('/', (req, res) => {
  res.send('URL Shortener Microservice is running');
});

// POST endpoint — create short URL
app.post('/api/shorturl', async (req, res) => {
  console.log('Received body:', req.body);
  const originalUrl = req.body.url;

  try {
    //  Validate protocol and URL format
    const parsedUrl = new URL(originalUrl);

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return res.json({ error: 'invalid url' });
    }

    //  DNS lookup to ensure hostname exists
    await dns.lookup(parsedUrl.hostname);

    // Check if URL already exists
    const existing = await Url.findOne({ original_url: originalUrl });
    if (existing) {
      return res.json({
        original_url: existing.original_url,
        short_url: existing.short_url
      });
    }

    //  Create new short_url (auto-increment style)
    const count = await Url.countDocuments();
    const newEntry = new Url({
      original_url: originalUrl,
      short_url: count + 1
    });

    await newEntry.save();

    return res.json({
      original_url: newEntry.original_url,
      short_url: newEntry.short_url
    });

  } catch (err) {
    console.error(' Error during URL processing:', err.message);
    return res.json({ error: 'invalid url' });
  }
});

// GET endpoint — redirect short_url to original_url
app.get('/api/shorturl/:short_url', async (req, res) => {
  const shortUrl = parseInt(req.params.short_url.trim(), 10);
  console.log('Redirect route hit with short_url:', shortUrl);

  if (isNaN(shortUrl)) {
    return res.json({ error: 'invalid url' });
  }

  try {
    const found = await Url.findOne({ short_url: shortUrl });
    if (!found) {
      return res.json({ error: 'No short URL found' });
    }

    console.log('Redirecting to:', found.original_url);
    return res.redirect(found.original_url);
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});


// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
