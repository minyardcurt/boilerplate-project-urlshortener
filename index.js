// Load environment variables
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const validUrl = require('valid-url'); // npm install valid-url

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Request logging (clean)
app.use((req, res, next) => {
  const cleanBody = req.body ? JSON.parse(JSON.stringify(req.body)) : {};
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} Body:`, cleanBody);
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
  const originalUrl = req.body.url?.trim();

  // Validate URL using valid-url
  if (!originalUrl || !validUrl.isWebUri(originalUrl)) {
    console.log('Invalid URL received:', originalUrl);
    return res.json({ error: 'invalid url' });
  }

  try {
    // Check if URL already exists
    const existing = await Url.findOne({ original_url: originalUrl });
    if (existing) {
      return res.json({
        original_url: existing.original_url,
        short_url: existing.short_url
      });
    }

    // Atomic short_url creation
    const lastEntry = await Url.findOne().sort({ short_url: -1 });
    const newShortUrl = lastEntry ? lastEntry.short_url + 1 : 1;

    const newEntry = await Url.create({
      original_url: originalUrl,
      short_url: newShortUrl
    });

    return res.json({
      original_url: newEntry.original_url,
      short_url: newEntry.short_url
    });

  } catch (err) {
    console.error('Error saving URL:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET endpoint — redirect short_url to original_url
app.get('/api/shorturl/:short_url', async (req, res) => {
  const shortUrl = parseInt(req.params.short_url?.trim(), 10);
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
