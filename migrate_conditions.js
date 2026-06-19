const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all('PRAGMA table_info(products)', (err, cols) => {
        const hasUnits = cols.some(c => c.name === 'units');
        
        const query = hasUnits ? 'SELECT id, condition, units FROM products' : 'SELECT id, condition FROM products';
        
        db.all(query, (err, rows) => {
            if (err) throw err;
            
            const updateStmt = hasUnits 
                ? db.prepare('UPDATE products SET condition = ?, units = ? WHERE id = ?')
                : db.prepare('UPDATE products SET condition = ? WHERE id = ?');
            
            let count = 0;
            
            for (let row of rows) {
                let changed = false;
                let currentCondition = row.condition;
                
                const mapCondition = (cond) => {
                    if (!cond) return cond;
                    if (cond === 'Usado' || cond === 'Regular' || cond === 'Perdido') return 'Buen estado';
                    if (cond === 'Para reparar' || cond === 'Roto' || cond === 'Para reparar / Roto') return 'Dañado/Reparación';
                    return cond;
                };
                
                const newCondition = mapCondition(currentCondition);
                if (newCondition !== currentCondition) {
                    changed = true;
                    currentCondition = newCondition;
                }
                
                let newUnits = hasUnits ? row.units : null;
                if (hasUnits && row.units && row.units !== '[]') {
                    try {
                        const unitsArr = JSON.parse(row.units);
                        let unitsChanged = false;
                        for (let u of unitsArr) {
                            const newUcond = mapCondition(u.condition);
                            if (newUcond !== u.condition) {
                                u.condition = newUcond;
                                unitsChanged = true;
                                changed = true;
                            }
                        }
                        if (unitsChanged) {
                            newUnits = JSON.stringify(unitsArr);
                        }
                    } catch(e) {}
                }
                
                if (changed) {
                    if (hasUnits) {
                        updateStmt.run([currentCondition, newUnits, row.id]);
                    } else {
                        updateStmt.run([currentCondition, row.id]);
                    }
                    count++;
                }
            }
            
            updateStmt.finalize(() => {
                console.log('Migration completed. Updated ' + count + ' products.');
                db.close();
            });
        });
    });
});
