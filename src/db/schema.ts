import { mysqlTable, serial, varchar, text, int, decimal, datetime, tinyint, json, mysqlEnum } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

// ── Users ──
export const usuarios = mysqlTable('usuarios', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 100 }).notNull(),
  password_hash: varchar('password_hash', { length: 255 }).notNull(),
  nome_completo: varchar('nome_completo', { length: 255 }),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`),
  deleted_at: datetime('deleted_at'),
  created_by: int('created_by'),
  updated_by: int('updated_by'),
  deleted_by: int('deleted_by'),
});

// ── Audit Log ──
export const audit_log = mysqlTable('audit_log', {
  id: serial('id').primaryKey(),
  user_id: int('user_id').notNull(),
  username: varchar('username', { length: 100 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  entity: varchar('entity', { length: 50 }).notNull(),
  entity_id: int('entity_id'),
  details: text('details'),
  old_data: text('old_data'),
  new_data: text('new_data'),
  ip_address: varchar('ip_address', { length: 45 }),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// ── Companies ──
export const empresas = mysqlTable('empresas', {
  id: serial('id').primaryKey(),
  nome: varchar('nome', { length: 255 }).notNull(),
  documento: varchar('documento', { length: 50 }),
  endereco: text('endereco'),
  telefone: varchar('telefone', { length: 50 }),
  email: varchar('email', { length: 100 }),
  detalhes_adicionais: text('detalhes_adicionais'),
  smtp_host: varchar('smtp_host', { length: 255 }),
  smtp_port: varchar('smtp_port', { length: 10 }),
  smtp_user: varchar('smtp_user', { length: 255 }),
  smtp_pass: varchar('smtp_pass', { length: 255 }),
  smtp_secure: varchar('smtp_secure', { length: 20 }),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`),
  deleted_at: datetime('deleted_at'),
  created_by: int('created_by'),
  updated_by: int('updated_by'),
  deleted_by: int('deleted_by'),
});

// ── Quotes ──
export const orcamentos = mysqlTable('orcamentos', {
  id: serial('id').primaryKey(),
  titulo: varchar('titulo', { length: 255 }).notNull(),
  data_criacao: datetime('data_criacao'),
  empresa1_id: int('empresa1_id').notNull().references(() => empresas.id),
  empresa2_id: int('empresa2_id').notNull().references(() => empresas.id),
  empresa3_id: int('empresa3_id').notNull().references(() => empresas.id),
  variacao_maxima: decimal('variacao_maxima', { precision: 5, scale: 2 }).notNull(),
  template1_id: int('template1_id').default(1),
  template2_id: int('template2_id').default(2),
  template3_id: int('template3_id').default(3),
  solicitante_nome: varchar('solicitante_nome', { length: 255 }),
  solicitante_cnpj: varchar('solicitante_cnpj', { length: 20 }),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`),
  deleted_at: datetime('deleted_at'),
  created_by: int('created_by'),
  updated_by: int('updated_by'),
  deleted_by: int('deleted_by'),
});

// ── Quote Items ──
export const itens_orcamento = mysqlTable('itens_orcamento', {
  id: serial('id').primaryKey(),
  orcamento_id: int('orcamento_id').notNull().references(() => orcamentos.id, { onDelete: 'cascade' }),
  codigo: int('codigo'),
  descricao: varchar('descricao', { length: 255 }).notNull(),
  quantidade: decimal('quantidade', { precision: 10, scale: 2 }).notNull(),
  valor_compra: decimal('valor_compra', { precision: 10, scale: 2 }).notNull(),
  valor_venda: decimal('valor_venda', { precision: 10, scale: 2 }),
  auto_preco: tinyint('auto_preco').default(0),
  marca_modelo: varchar('marca_modelo', { length: 255 }),
  link_compra: varchar('link_compra', { length: 500 }),
});
