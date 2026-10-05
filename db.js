const { Pool } = require('pg');

// Configuración directa a la base de datos
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'parqueadero_db',
  password: '12345', // <--- Escribe tu contraseña aquí dentro de las comillas
  port: 5432,
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Error de conexión a PostgreSQL:', err.message);
  }
  console.log('✅ Conexión exitosa a PostgreSQL (parqueadero_db)');
  release();
});

module.exports = pool;