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

// Connect to MongoDB Atlas
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
  const hostname = urlParser.parse(originalUrl).hostname;

  if (!hostname) return res.json({ error: 'invalid url' });

  try {
    // DNS validation
    await dns.lookup(hostname);

    // Check if URL already exists
    let foundUrl = await Url.findOne({ original_url: originalUrl });
    if (foundUrl) {
      return res.json({
        original_url: foundUrl.original_url,
        short_url: foundUrl.short_url
      });
    }

    // Generate new short_url
    const count = await Url.countDocuments();
    const newUrl = new Url({
      original_url: originalUrl,
      short_url: count + 1
    });

    await newUrl.save();

    res.json({
      original_url: newUrl.original_url,
      short_url: newUrl.short_url
    });
  } catch (err) {
    return res.json({ error: 'invalid url' });
  }
});

// GET endpoint to redirect to original URL
app.get('/api/shorturl/:short_url', async (req, res) => {
  const shortUrl = Number(req.params.short_url);

  try {
    const foundUrl = await Url.findOne({ short_url: shortUrl });
    if (!foundUrl) return res.json({ error: 'invalid url' });

    res.redirect(foundUrl.original_url);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

