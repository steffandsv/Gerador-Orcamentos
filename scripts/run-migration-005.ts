import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config();

async function runMigration() {
    const conn = await mysql.createConnection(process.env.DATABASE_URL!);
    const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '005_empresa_docs.sql'), 'utf-8');
    
    console.log('Running migration: 005_empresa_docs.sql');
    const statements = sql.split(';').filter(s => s.trim());
    
    for (const stmt of statements) {
        if (stmt.trim().startsWith('--')) continue;
        try {
            await conn.query(stmt);
            console.log('  ✅ Executed:', stmt.trim().substring(0, 60) + '...');
        } catch (e: any) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('  ⏭️  Column already exists, skipping');
            } else {
                console.error('  ❌ Error:', e.message);
            }
        }
    }
    
    await conn.end();
    console.log('Migration complete!');
}

runMigration().catch(console.error);
