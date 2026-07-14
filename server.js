const express = require('express');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'applications.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'curiosity2026';
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'curiosity-ai-club-secret-2026';
const NOTIFY_EMAILS = process.env.NOTIFY_EMAILS || '';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(COOKIE_SECRET));
app.use(express.static('public', { extensions: ['html'] }));

const storage = multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function readDB() {
    if (!fs.existsSync(DB_FILE)) return [];
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch { return []; }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function generateToken() {
    return crypto.createHmac('sha256', COOKIE_SECRET).update(ADMIN_USER + ADMIN_PASS).digest('hex');
}

function authMiddleware(req, res, next) {
    const token = req.signedCookies?.admin_token;
    if (token === generateToken()) return next();
    res.status(401).json({ error: 'unauthorized' });
}

// ── Submit application ──
app.post('/api/apply', (req, res, next) => {
    upload.array('screenshots', 5)(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Maximum 10 MB per file.' });
            return res.status(400).json({ error: 'Upload failed. Please try again.' });
        }
        next();
    });
}, (req, res) => {
    try {
        const applications = readDB();

        const application = {
            id: `app_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
            submitted_at: new Date().toISOString(),
            status: 'new',
            first_name: req.body.first_name || '',
            last_name: req.body.last_name || '',
            role: req.body.role || '',
            email: req.body.email || '',
            github: req.body.github || '',
            ai_tools: [].concat(req.body.ai_tools || []),
            deployment: [].concat(req.body.deployment || []),
            other_platforms: req.body.other_platforms || '',
            hardware: req.body.hardware || '',
            stack_extras: req.body.stack_extras || '',
            project_description: req.body.project_description || '',
            project_link: req.body.project_link || '',
            projects_shipped: req.body.projects_shipped || '',
            hours_per_week: req.body.hours_per_week || '',
            screenshots: (req.files || []).map(f => f.filename),
            frustration_story: req.body.frustration_story || '',
            business_problem: req.body.business_problem || '',
            current_struggle: req.body.current_struggle || '',
            demo_pitch: req.body.demo_pitch || '',
            domain_expertise: req.body.domain_expertise || '',
            notes: ''
        };

        applications.push(application);
        writeDB(applications);

        if (NOTIFY_EMAILS && process.env.SMTP_HOST) {
            sendNotification(application).catch(err => console.error('Email failed:', err.message));
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Application save failed:', err.message);
        res.status(500).json({ error: 'Something went wrong saving your application. Please try again.' });
    }
});

// ── Admin auth ──
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        res.cookie('admin_token', generateToken(), {
            signed: true, httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        });
        return res.json({ success: true });
    }
    res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/admin/logout', (req, res) => {
    res.clearCookie('admin_token');
    res.json({ success: true });
});

app.get('/api/admin/check', authMiddleware, (req, res) => {
    res.json({ authenticated: true });
});

app.get('/api/admin/applications', authMiddleware, (req, res) => {
    res.json(readDB().reverse());
});

app.patch('/api/admin/applications/:id', authMiddleware, (req, res) => {
    const applications = readDB();
    const idx = applications.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    if (req.body.status) applications[idx].status = req.body.status;
    if (req.body.notes !== undefined) applications[idx].notes = req.body.notes;
    writeDB(applications);
    res.json(applications[idx]);
});

app.delete('/api/admin/applications/:id', authMiddleware, (req, res) => {
    const applications = readDB();
    const idx = applications.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const [removed] = applications.splice(idx, 1);
    writeDB(applications);
    res.json({ success: true, removed: removed.id });
});

app.get('/api/admin/uploads/:filename', authMiddleware, (req, res) => {
    const safe = path.basename(req.params.filename);
    const filePath = path.join(UPLOADS_DIR, safe);
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
    res.status(404).json({ error: 'File not found' });
});

async function sendNotification(app) {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: NOTIFY_EMAILS,
        subject: `New Application: ${app.first_name} ${app.last_name} — ${app.role}`,
        text: [
            'New application for The Curiosity AI Club.',
            '',
            `Name: ${app.first_name} ${app.last_name}`,
            `Role: ${app.role}`,
            `LinkedIn: ${app.linkedin}`,
            `GitHub: ${app.github}`,
            '',
            `Project: ${app.project_description}`,
            `Link: ${app.project_link}`,
            '',
            `Review at: ${process.env.SITE_URL || 'https://curiosityai.online'}/admin.html`
        ].join('\n')
    });
}

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Curiosity AI Club running on port ${PORT}`);
});

// Shut down cleanly when Railway replaces the container on redeploy,
// so a normal deploy isn't reported as a crash.
for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
        console.log(`Received ${signal}, shutting down gracefully`);
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 5000).unref();
    });
}
