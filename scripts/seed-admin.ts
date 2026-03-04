import dotenv from 'dotenv';
dotenv.config();

import { db } from '../db';
import { usuarios } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('Checking for admin user...');

  const existing = await db.select().from(usuarios).where(eq(usuarios.username, 'admin'));

  if (existing.length > 0) {
    console.log('Admin user already exists. Skipping seed.');
    process.exit(0);
  }

  const hash = await bcrypt.hash('stelia', 10);
  console.log('Generated bcrypt hash for admin.');

  await db.insert(usuarios).values({
    username: 'admin',
    password_hash: hash,
    nome_completo: 'Administrador',
    role: 'admin',
  });

  console.log('✅ Admin user created successfully!');
  console.log('   Login: admin');
  console.log('   Senha: stelia');
  process.exit(0);
}

seed().catch((e) => {
  console.error('Seed error:', e);
  process.exit(1);
});
