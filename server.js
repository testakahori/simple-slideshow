const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'slideshows.json');

// Ensure directories exist
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}-${name}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Images only'));
  }
});
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ slideshows: [] }, null, 2));
}

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = ['localhost'];
  for (const iface of Object.values(interfaces)) {
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        ips.push(alias.address);
      }
    }
  }
  return ips;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Server info
app.get('/api/server-info', (req, res) => {
  res.json({ ips: getLocalIPs(), port: PORT });
});

// List all slideshows
app.get('/api/slideshows', (req, res) => {
  const data = readData();
  res.json(data.slideshows);
});

// Get one slideshow
app.get('/api/slideshows/:id', (req, res) => {
  const data = readData();
  const slideshow = data.slideshows.find(s => s.id === req.params.id);
  if (!slideshow) return res.status(404).json({ error: 'Not found' });
  res.json(slideshow);
});

// Create slideshow
app.post('/api/slideshows', (req, res) => {
  const data = readData();
  const slideshow = {
    id: crypto.randomUUID(),
    title: req.body.title || 'New Slideshow',
    aspectRatio: req.body.aspectRatio || '16:9',
    slides: [],
    settings: {
      transition: 'fade',
      autoplay: true,
      loop: true,
      interval: 5
    },
    createdAt: new Date().toISOString()
  };
  data.slideshows.push(slideshow);
  writeData(data);
  res.json(slideshow);
});

// Update slideshow
app.put('/api/slideshows/:id', (req, res) => {
  const data = readData();
  const index = data.slideshows.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  data.slideshows[index] = {
    ...data.slideshows[index],
    ...req.body,
    id: req.params.id,
    createdAt: data.slideshows[index].createdAt
  };
  writeData(data);
  res.json(data.slideshows[index]);
});

// Delete slideshow
app.delete('/api/slideshows/:id', (req, res) => {
  const data = readData();
  const index = data.slideshows.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  data.slideshows.splice(index, 1);
  writeData(data);
  res.json({ success: true });
});

// Image upload
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// Viewer route
app.get('/view/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'viewer.html'));
});

app.listen(PORT, () => {
  const ips = getLocalIPs();
  console.log('\n=== Simple Slideshow ===');
  console.log(`Management UI:`);
  ips.forEach(ip => console.log(`  http://${ip}:${PORT}`));
  console.log(`Viewer URLs: http://localhost:${PORT}/view/[slideshow-id]`);
  console.log('========================\n');
});
