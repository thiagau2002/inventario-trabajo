const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Permitir imágenes grandes (base64)
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Base de Datos SQLite
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Error al conectar con la base de datos:', err);
    else console.log('Conectado a la base de datos SQLite.');
});

// Inicializar Tabla
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT,
        category TEXT,
        brand TEXT,
        serial TEXT,
        location TEXT,
        condition TEXT,
        quantity INTEGER,
        minStock INTEGER,
        assigned TEXT,
        desc TEXT,
        image TEXT
    )`);
});

// --- Rutas API REST ---

// Obtener todos los elementos
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Añadir un elemento
app.post('/api/products', (req, res) => {
    const { id, name, category, brand, serial, location, condition, quantity, minStock, assigned, desc, image } = req.body;
    db.run(`INSERT INTO products (id, name, category, brand, serial, location, condition, quantity, minStock, assigned, desc, image) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, category, brand, serial, location, condition, quantity, minStock, assigned, desc, image],
        function (err) {
            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }
            res.json({ id, message: 'Elemento añadido' });
        });
});

// Actualizar un elemento
app.put('/api/products/:id', (req, res) => {
    const { name, category, brand, serial, location, condition, quantity, minStock, assigned, desc, image } = req.body;
    db.run(`UPDATE products SET 
            name = ?, category = ?, brand = ?, serial = ?, location = ?, condition = ?, 
            quantity = ?, minStock = ?, assigned = ?, desc = ?, image = ? 
            WHERE id = ?`,
        [name, category, brand, serial, location, condition, quantity, minStock, assigned, desc, image, req.params.id],
        function (err) {
            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }
            res.json({ updated: this.changes, message: 'Elemento actualizado' });
        });
});

// Eliminar un elemento
app.delete('/api/products/:id', (req, res) => {
    db.run(`DELETE FROM products WHERE id = ?`, req.params.id, function (err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ deleted: this.changes, message: 'Elemento eliminado' });
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(\`Servidor en ejecución en http://localhost:\${PORT}\`);
});
