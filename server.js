const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Permitir imágenes grandes (base64)
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Base de Datos SQLite
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'database.sqlite');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}
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
    
    db.run(`ALTER TABLE products ADD COLUMN units TEXT`, (err) => {
        // Ignorar error si la columna ya existe
    });
    
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    )`);
    
    const defaultCategories = [
        'Laptops', 'Monitores', 'Periféricos', 'Cables y Adaptadores', 
        'Redes / Switches', 'Servidores', 'Cámaras', 'Herramientas', 
        'Audio', 'Impresoras', 'Teléfonos / Celulares', 'Componentes PC', 'Otro'
    ];
    const stmt = db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)");
    defaultCategories.forEach(c => stmt.run(c));
    stmt.finalize();
});

// --- Rutas API REST ---

// Obtener categorías
app.get('/api/categories', (req, res) => {
    db.all("SELECT * FROM categories ORDER BY name", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Crear categoría
app.post('/api/categories', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre es requerido' });
    
    db.run("INSERT INTO categories (name) VALUES (?)", [name], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, name });
    });
});

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
    const { id, name, category, brand, serial, location, condition, quantity, minStock, assigned, desc, image, units } = req.body;
    db.run(`INSERT INTO products (id, name, category, brand, serial, location, condition, quantity, minStock, assigned, desc, image, units) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, category, brand, serial, location, condition, quantity, minStock, assigned, desc, image, units || '[]'],
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
    const { name, category, brand, serial, location, condition, quantity, minStock, assigned, desc, image, units } = req.body;
    db.run(`UPDATE products SET 
            name = ?, category = ?, brand = ?, serial = ?, location = ?, condition = ?, 
            quantity = ?, minStock = ?, assigned = ?, desc = ?, image = ?, units = ? 
            WHERE id = ?`,
        [name, category, brand, serial, location, condition, quantity, minStock, assigned, desc, image, units || '[]', req.params.id],
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
    console.log("Servidor en ejecución en el puerto " + PORT);
});
