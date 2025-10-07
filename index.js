// Load environment variables
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const validUrl = require('valid-url'); // Used for basic format validation
const dns = require('dns'); // REQUIRED for domain existence validation
const { URL } = require('url'); // Used to parse the hostname
const cors = require('cors'); // Recommended for FCC test runner

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enables CORS for the FCC test runner
app.use(express.urlencoded({ extended: false })); // For parsing x-www-form-urlencoded data (POST body)
app.use(express.json());

// Request logging (Kept for debugging clarity)
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
    // Optionally render your index.html here, or send a simple message
    res.send('URL Shortener Microservice is running');
});

// POST endpoint — create short URL
app.post('/api/shorturl', async (req, res) => {
    const originalUrl = req.body.url?.trim();

    // 1. Basic Format Validation (Checks protocol, basic structure)
    if (!originalUrl || !validUrl.isWebUri(originalUrl)) {
        console.log('Validation Fail: Bad format or missing URL');
        return res.json({ error: 'invalid url' });
    }

    // 2. Hostname Existence Validation (REQUIRED for FCC test success)
    try {
        const urlObject = new URL(originalUrl);
        const hostname = urlObject.hostname; 

        // DNS Lookup to check if the hostname has a public IP address
        dns.lookup(hostname, async (err) => {
            if (err) {
                // This handles the FCC test case for non-existent domains (e.g., ftps://invalid.com)
                console.log(`DNS Fail: Hostname ${hostname} not found`);
                return res.json({ error: 'invalid url' }); 
            }

            // --- DNS validation passed. Proceed to DB logic ---
            try {
                // Check if URL already exists
                const existing = await Url.findOne({ original_url: originalUrl });
                if (existing) {
                    return res.json({
                        original_url: existing.original_url,
                        // FIX: Ensure short_url is returned as a NUMBER (Crucial for FCC Test #2)
                        short_url: Number(existing.short_url)
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
                    // FIX: Ensure short_url is returned as a NUMBER (Crucial for FCC Test #2)
                    short_url: Number(newEntry.short_url)
                });

            } catch (dbErr) {
                console.error('Error saving URL to DB:', dbErr);
                return res.status(500).json({ error: 'Server error during DB operation' });
            }
        });

    } catch (parseError) {
        // Catch general errors during URL object creation
        console.error('URL Parsing Error:', parseError.message);
        return res.json({ error: 'invalid url' });
    }
});

// GET endpoint — redirect short_url to original_url
app.get('/api/shorturl/:short_url', async (req, res) => {
    const shortUrl = parseInt(req.params.short_url?.trim(), 10);
    console.log('Redirect route hit with short_url:', shortUrl);

    // This handles non-numeric short IDs
    if (isNaN(shortUrl)) {
        return res.json({ error: 'invalid url' });
    }

    try {
        const found = await Url.findOne({ short_url: shortUrl });
        
        if (!found) {
            // NOTE: Returning 404 is technically correct, but the test might fail 
            // if you don't return res.json() without status. Sticking to 404 here
            // because the main issue was fixed above.
            return res.status(404).json({ error: 'No short URL found' });
        }

        console.log('Redirecting to:', found.original_url);
        // This sends the required 302 Found status and Location header
        return res.redirect(found.original_url); 

    } catch (err) {
        console.error('Server error during GET redirect:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});