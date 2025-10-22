const path = require('path');
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const fs = require('fs');
const https = require('https');

const app = express();
const port = process.env.PORT || 3000;

// Configure Postgres connection via env vars (works with docker-compose)
// Ensure env vars are strings (avoid errors from non-string types)
const dbHost = process.env.DB_HOST ? String(process.env.DB_HOST) : 'localhost';
const dbUser = process.env.DB_USER ? String(process.env.DB_USER) : 'postgres';
const dbPassword = process.env.DB_PASSWORD ? String(process.env.DB_PASSWORD) : '';
const dbName = process.env.DB_NAME ? String(process.env.DB_NAME) : 'demo';
const dbPort = process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432;

const pool = new Pool({
  host: dbHost,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  port: dbPort,
});

if (!dbPassword) console.warn('Warning: DB password is empty; ensure this is intentional.');

app.use(cors());
app.use(express.json());

// Bcrypt work factor (cost). Set BCRYPT_ROUNDS in env to increase/decrease cost.
const BCRYPT_ROUNDS = process.env.BCRYPT_ROUNDS ? Math.max(4, parseInt(process.env.BCRYPT_ROUNDS, 10)) : 10;

// Serve static files (index.html) from the current directory
app.use(express.static(path.join(__dirname)));

async function initializeDb() {
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Table for password reset tokens
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(128) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    client.release();
    console.log('Postgres: users table ready');
  } catch (err) {
    console.error('DB init error:', err.message || err);
  }
}

initializeDb();

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ message: 'username and password required' });

  // Use configured rounds directly; bcrypt.hash will generate salt internally.
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [username, email || null, hash]
    );

    res.status(201).json({ message: 'registered', userId: result.rows[0].id });
  } catch (err) {
    console.error('Register error:', err.message || err);
    if (err.code === '23505') return res.status(409).json({ message: 'username or email already exists' });
    res.status(500).json({ message: 'internal error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { login, password } = req.body || {};
    if (!login || !password) return res.status(400).json({ message: 'login (username/email) and password required' });

    // Check both username and email fields
    const result = await pool.query(
      'SELECT id, username, email, password_hash FROM users WHERE username = $1 OR email = $1',
      [login]
    );
    if (result.rows.length === 0) return res.status(401).json({ message: 'invalid credentials' });

    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: 'invalid credentials' });

    // For a real app, return a signed JWT. Here we return a placeholder.
    res.json({
      message: 'ok',
      userId: user.id,
      username: user.username,
      email: user.email,
      token: 'fake-jwt-token'
    });
  } catch (err) {
    console.error('Login error:', err.message || err);
    res.status(500).json({ message: 'internal error' });
  }
});

// --- Password reset: request reset token ---
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'email required' });

    const userRes = await pool.query('SELECT id, username, email FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      // Don't reveal whether email exists
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const user = userRes.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await pool.query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    // send email with token link
    const resetUrl = `${req.protocol}://${req.get('host')}/reset.html?token=${token}`;

    // configure transporter from env or use ethereal for dev
    let transporter;
    if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
    } else {
      // fallback to ethereal
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
    }

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'no-reply@example.com',
      to: user.email,
      subject: 'Reset mật khẩu',
      text: `Để đặt lại mật khẩu, vui lòng truy cập: ${resetUrl}`,
      html: `<p>Để đặt lại mật khẩu, vui lòng <a href="${resetUrl}">bấm vào đây</a>.</p>`
    });

    console.log('Password reset email sent:', nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : info.messageId);

    return res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err.message || err);
    return res.status(500).json({ message: 'internal error' });
  }
});

// --- Password reset: set new password ---
app.post('/api/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ message: 'token and password required' });

    const pr = await pool.query('SELECT id, user_id, expires_at, used FROM password_resets WHERE token = $1', [token]);
    if (pr.rows.length === 0) return res.status(400).json({ message: 'invalid token' });
    const row = pr.rows[0];
    if (row.used) return res.status(400).json({ message: 'token already used' });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ message: 'token expired' });

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, row.user_id]);
    await pool.query('UPDATE password_resets SET used = TRUE WHERE id = $1', [row.id]);

    // optional: auto-login by returning success and (in real app) a JWT
    return res.json({ message: 'password reset ok' });
  } catch (err) {
    console.error('Reset password error:', err.message || err);
    return res.status(500).json({ message: 'internal error' });
  }
});


// --- HTTPS optional support ---
const httpPort = Number(process.env.PORT || port);
const useHttps = process.env.USE_HTTPS === 'true';
const httpsKeyPath = process.env.HTTPS_KEY_PATH || path.join(__dirname, 'certs', 'key.pem');
const httpsCertPath = process.env.HTTPS_CERT_PATH || path.join(__dirname, 'certs', 'cert.pem');
const httpsPort = process.env.HTTPS_PORT ? Number(process.env.HTTPS_PORT) : 3443;
const redirectToHttps = process.env.REDIRECT_TO_HTTPS === 'true';

if (useHttps) {
  if (fs.existsSync(httpsKeyPath) && fs.existsSync(httpsCertPath)) {
    try {
      const key = fs.readFileSync(httpsKeyPath);
      const cert = fs.readFileSync(httpsCertPath);
      https.createServer({ key, cert }, app).listen(httpsPort, () => {
        console.log(`HTTPS server running on https://localhost:${httpsPort}`);
      });

      if (redirectToHttps) {
        // lightweight redirector on HTTP -> HTTPS
        const redirectApp = express();
        redirectApp.use((req, res) => {
          const host = req.headers.host ? req.headers.host.split(':')[0] : 'localhost';
          return res.redirect(`https://${host}:${httpsPort}${req.url}`);
        });
        redirectApp.listen(httpPort, () => console.log(`HTTP -> HTTPS redirector listening on http://localhost:${httpPort}`));
      } else {
        // also keep HTTP server available if desired
        app.listen(httpPort, () => console.log(`HTTP server running on http://localhost:${httpPort}`));
      }
    } catch (err) {
      console.error('Failed to start HTTPS server:', err);
      app.listen(httpPort, () => console.log(`Server running on http://localhost:${httpPort}`));
    }
  } else {
    console.warn(`HTTPS requested but cert files not found at ${httpsKeyPath} and ${httpsCertPath}. Falling back to HTTP.`);
    app.listen(httpPort, () => console.log(`Server running on http://localhost:${httpPort}`));
  }
} else {
  app.listen(httpPort, () => console.log(`Server running on http://localhost:${httpPort}`));
}
