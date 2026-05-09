require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');

const app = express();
const port = process.env.PORT || 80;

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME,
    key: function (req, file, cb) {
      cb(null, 'laporan-' + Date.now().toString() + path.extname(file.originalname));
    }
  })
});

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

pool.query(`
  CREATE TABLE IF NOT EXISTS laporan (
    id SERIAL PRIMARY KEY,
    nama_penumpang VARCHAR(255),
    stasiun VARCHAR(100),
    kendala TEXT,
    foto_key VARCHAR(255),
    waktu TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(err => console.error(err));

app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM laporan ORDER BY waktu DESC');
    res.render('index', { 
        laporan: result.rows,
        cloudfrontUrl: process.env.CLOUDFRONT_URL 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Terjadi kesalahan pada server.");
  }
});

app.post('/lapor', upload.single('fotoBukti'), async (req, res) => {
  try {
    const { namaPenumpang, stasiun, kendala } = req.body;
    const fotoKey = req.file.key; 

    await pool.query(
      'INSERT INTO laporan (nama_penumpang, stasiun, kendala, foto_key) VALUES ($1, $2, $3, $4)',
      [namaPenumpang, stasiun, kendala, fotoKey]
    );
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal mengunggah laporan.");
  }
});

app.listen(port, () => {
  console.log(`WhooshTracker berjalan di port ${port}`);
});