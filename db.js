require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect((err, client, release) => {
  if (err) return console.error('❌ Error de conexión a Supabase:', err.message);
  console.log('✅ Conexión exitosa a Supabase');
  release();
});

module.exports = pool;