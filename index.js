// Load environment variables
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const dns = require('dns').promises;
const urlParser = require('url');

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse POST requests
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// 🔍 Middleware to log every incoming request
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define URL Schema
const urlSchema = new mongoose.Schema({
  original_url: { type: String, required: true },
  short_url: { type: Number, required: true, unique: true }
});

const Url = mongoose.model('Url', urlSchema);

// Root endpoint
app.get('/', (req, res) => {
  res.send('URL Shortener Microservice is running');
});

// POST endpoint to create short URL
app.post('/api/shorturl', async (req, res) => {
  const originalUrl = req.body.url;

  try {
    // Validate the URL format
    const parsedUrl = new URL(originalUrl);

    // DNS validation
    await dns.lookup(parsedUrl.hostname);

    // Check if the URL already exists in DB
    let existing = await Url.findOne({ original_url: originalUrl });
    if (existing) {
      return res.json({
        original_url: existing.original_url,
        short_url: existing.short_url
      });
    }

    // Generate new short_url (auto-increment style)
    const count = await Url.countDocuments();
    const newEntry = new Url({
      original_url: originalUrl,
      short_url: count + 1
    });

    await newEntry.save();

    res.json({
      original_url: newEntry.original_url,
      short_url: newEntry.short_url
    });
  } catch (err) {
    return res.json({ error: 'invalid url' });
  }
});

// GET endpoint to redirect to original URL
app.get('/api/shorturl/:short_url', async (req, res) => {
  const shortUrl = Number(req.params.short_url);
  console.log('➡️ Redirect route hit with short_url:', shortUrl);

  if (isNaN(shortUrl)) {
    console.log('❌ Not a number');
    return res.json({ error: 'invalid url' });
  }

  try {
    const found = await Url.findOne({ short_url: shortUrl });
    if (!found) {
      console.log('❌ No URL found in database');
      return res.json({ error: 'No short URL found' });
    }

    console.log('✅ Redirecting to:', found.original_url);
    return res.redirect(found.original_url);
  } catch (err) {
    console.error('🔥 Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});


// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});