const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ---------------------------------------------------------
// 1. INICIALIZACIÓN (160 Espacios y Usuario Admin)
// ---------------------------------------------------------
async function inicializarSistema() {
  try {
    // Intentar crear Administrador en la BD (Por si la tabla roles existe)
    try {
      const adminCheck = await pool.query("SELECT id FROM usuarios WHERE identificacion = 'admin'");
      if (adminCheck.rows.length === 0) {
        await pool.query(
          "INSERT INTO usuarios (identificacion, nombre_completo, correo_institucional, rol_id, password_hash) VALUES ('admin', 'Administrador CESMAG', 'admin@unicesmag.edu.co', 1, 'admin123')"
        );
      }
    } catch (e) {
      console.log('⚠️ Aviso: No se pudo registrar el admin en BD, pero el parche de seguridad permitirá su acceso.');
    }

    // Verificar y crear Espacios (100 Motos, 60 Bicis)
    const check = await pool.query('SELECT COUNT(*) FROM espacios');
    if (parseInt(check.rows[0].count) < 160) {
      console.log('🔄 Formateando base de datos a 160 espacios...');
      await pool.query('TRUNCATE TABLE espacios CASCADE');
      
      for (let i = 1; i <= 100; i++) {
        await pool.query('INSERT INTO espacios (numero_espacio, tipo_vehiculo, estado) VALUES ($1, $2, $3)', [`M-${String(i).padStart(3, '0')}`, 'MOTO', 'LIBRE']);
      }
      for (let i = 1; i <= 60; i++) {
        await pool.query('INSERT INTO espacios (numero_espacio, tipo_vehiculo, estado) VALUES ($1, $2, $3)', [`B-${String(i).padStart(3, '0')}`, 'BICICLETA', 'LIBRE']);
      }
      console.log('🌱 ¡160 espacios listos!');
    }
  } catch (err) {
    console.error('Error inicializando sistema:', err.message);
  }
}

// ---------------------------------------------------------
// 2. MÓDULO DE SEGURIDAD Y LOGIN (RF-10, RNF-01)
// ---------------------------------------------------------
app.post('/api/login', async (req, res) => {
  const { identificacion, password } = req.body;
  try {
    // 🔥 PARCHE INFALIBLE: Siempre permite al Administrador entrar
    if (identificacion === 'admin' && password === 'admin123') {
      return res.json({ success: true, nombre: 'Administrador CESMAG', rol: 1 });
    }

    // Validación normal para otros usuarios
    const user = await pool.query('SELECT * FROM usuarios WHERE identificacion = $1 AND password_hash = $2', [identificacion, password]);
    if (user.rows.length > 0) {
      res.json({ success: true, nombre: user.rows[0].nombre_completo, rol: user.rows[0].rol_id });
    } else {
      res.status(401).json({ error: 'Credenciales incorrectas.' });
    }
  } catch (error) { 
    res.status(500).json({ error: 'Error del servidor: ' + error.message }); 
  }
});

// ---------------------------------------------------------
// 3. MÓDULO DE ESPACIOS E INGRESOS
// ---------------------------------------------------------
app.get('/api/espacios', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM espacios ORDER BY numero_espacio ASC');
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/ingreso', async (req, res) => {
  const { identificacion, nombre_completo, tipo_vehiculo, placa_o_codigo, marca, color } = req.body;
  try {
    const placaLimpia = placa_o_codigo.trim().toUpperCase();
    
    const espacioLibre = await pool.query('SELECT id, numero_espacio FROM espacios WHERE tipo_vehiculo = $1 AND estado = $2 ORDER BY numero_espacio ASC LIMIT 1', [tipo_vehiculo, 'LIBRE']);
    if (espacioLibre.rows.length === 0) return res.status(400).json({ error: `Parqueadero lleno para ${tipo_vehiculo}.` });

    const { id: espacio_id, numero_espacio } = espacioLibre.rows[0];

    // Gestión de Usuario
    let userResult = await pool.query('SELECT id FROM usuarios WHERE identificacion = $1', [identificacion]);
    let usuario_id;
    if (userResult.rows.length === 0) {
      const nuevoUsuario = await pool.query("INSERT INTO usuarios (identificacion, nombre_completo, correo_institucional, rol_id, password_hash) VALUES ($1, $2, $3, 3, '12345') RETURNING id", [identificacion, nombre_completo, `${identificacion}@unicesmag.edu.co`]);
      usuario_id = nuevoUsuario.rows[0].id;
    } else {
      usuario_id = userResult.rows[0].id;
    }

    // Gestión de Vehículo
    let vehiculoResult = await pool.query('SELECT id FROM vehiculos WHERE placa_o_codigo = $1', [placaLimpia]);
    let vehiculo_id;
    if (vehiculoResult.rows.length === 0) {
      const nuevoVehiculo = await pool.query('INSERT INTO vehiculos (usuario_id, tipo_vehiculo, placa_o_codigo, marca, color) VALUES ($1, $2, $3, $4, $5) RETURNING id', [usuario_id, tipo_vehiculo, placaLimpia, marca, color]);
      vehiculo_id = nuevoVehiculo.rows[0].id;
    } else {
      vehiculo_id = vehiculoResult.rows[0].id;
      const activo = await pool.query("SELECT id FROM movimientos WHERE vehiculo_id = $1 AND estado = 'ACTIVO'", [vehiculo_id]);
      if (activo.rows.length > 0) return res.status(400).json({ error: 'El vehículo ya se encuentra ingresado.' });
    }

    // Registrar Entrada
    await pool.query("INSERT INTO movimientos (vehiculo_id, espacio_id, estado) VALUES ($1, $2, 'ACTIVO')", [vehiculo_id, espacio_id]);
    await pool.query("UPDATE espacios SET estado = 'OCUPADO' WHERE id = $1", [espacio_id]);

    res.json({ mensaje: `¡Ingreso exitoso! Espacio asignado: ${numero_espacio}` });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/salida', async (req, res) => {
  try {
    const placaLimpia = req.body.placa_o_codigo.trim().toUpperCase();
    const mov = await pool.query(`SELECT m.id, m.espacio_id FROM movimientos m JOIN vehiculos v ON m.vehiculo_id = v.id WHERE v.placa_o_codigo = $1 AND m.estado = 'ACTIVO'`, [placaLimpia]);
    
    if (mov.rows.length === 0) return res.status(404).json({ error: 'Vehículo no encontrado adentro.' });

    await pool.query("UPDATE movimientos SET fecha_hora_salida = CURRENT_TIMESTAMP, estado = 'FINALIZADO' WHERE id = $1", [mov.rows[0].id]);
    await pool.query("UPDATE espacios SET estado = 'LIBRE' WHERE id = $1", [mov.rows[0].espacio_id]);
    
    res.json({ mensaje: 'Salida completada. Espacio liberado exitosamente.' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ---------------------------------------------------------
// 4. MÓDULO DE REPORTES
// ---------------------------------------------------------
app.get('/api/reportes/movimientos', async (req, res) => {
  const { filtro } = req.query;
  let query = `
    SELECT m.id, v.placa_o_codigo, v.tipo_vehiculo, u.nombre_completo, e.numero_espacio, 
           TO_CHAR(m.fecha_hora_ingreso, 'DD/MM/YYYY HH12:MI AM') as ingreso,
           TO_CHAR(m.fecha_hora_salida, 'DD/MM/YYYY HH12:MI AM') as salida, m.estado
    FROM movimientos m
    JOIN vehiculos v ON m.vehiculo_id = v.id
    JOIN usuarios u ON v.usuario_id = u.id
    JOIN espacios e ON m.espacio_id = e.id
  `;
  if (filtro === 'activos') query += ` WHERE m.estado = 'ACTIVO'`;
  query += ` ORDER BY m.fecha_hora_ingreso DESC`;
  
  try {
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/reportes/buscar', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.placa_o_codigo, v.tipo_vehiculo, v.marca, v.color, u.identificacion, u.nombre_completo 
      FROM vehiculos v JOIN usuarios u ON v.usuario_id = u.id 
      WHERE v.placa_o_codigo ILIKE $1 OR u.identificacion ILIKE $1
    `, [`%${req.query.q}%`]);
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ---------------------------------------------------------
const server = app.listen(PORT, async () => {
  await inicializarSistema();
  console.log(`🚀 Servidor en línea: http://localhost:${PORT}`);
});
server.on('error', (err) => console.error('Error del servidor:', err));