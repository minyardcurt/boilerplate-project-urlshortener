// Load environment variables
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const dns = require('dns');
const urlParser = require('url');

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse POST requests
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
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

  // Validate URL using dns.lookup
  const hostname = urlParser.parse(originalUrl).hostname;

  if (!hostname) return res.json({ error: 'invalid url' });

  dns.lookup(hostname, async (err) => {
    if (err) return res.json({ error: 'invalid url' });

    try {
      // Check if URL already exists
      let foundUrl = await Url.findOne({ original_url: originalUrl });
      if (foundUrl) {
        return res.json({ original_url: foundUrl.original_url, short_url: foundUrl.short_url });
      }

      // Count current documents to generate next short_url
      const count = await Url.countDocuments();
      const newUrl = new Url({
        original_url: originalUrl,
        short_url: count + 1
      });

      await newUrl.save();
      res.json({ original_url: originalUrl, short_url: count + 1 });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
});

// GET endpoint to redirect to original URL
app.get('/api/shorturl/:short_url', async (req, res) => {
  const shortUrl = req.params.short_url;

  try {
    const foundUrl = await Url.findOne({ short_url: shortUrl });
    if (foundUrl) return res.redirect(foundUrl.original_url);

    res.json({ error: 'No short URL found for given input' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
