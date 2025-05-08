/**
 * Script para verificar e corrigir colunas meta_* na tabela user_servers
 * Usa SQL nativo para contornar problemas com o ORM
 */

import pg from 'pg';
import path from 'path';
import fs from 'fs';
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  try {
    console.log('Verificando tabela user_servers...');
    
    // Verificar se a tabela user_servers existe
    const tableResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_servers'
      )
    `);
    
    if (!tableResult.rows[0].exists) {
      console.error('Tabela user_servers não existe!');
      return;
    }
    
    console.log('Tabela user_servers existe.');
    
    // Verificar quais colunas existem
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'user_servers'
      ORDER BY ordinal_position
    `);
    
    console.log('\nColunas na tabela user_servers:');
    columnsResult.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}, default: ${col.column_default || 'NULL'}, nullable: ${col.is_nullable}`);
    });
    
    // Verificar se as colunas meta_* existem
    const metaColumnsNeeded = [
      { name: 'meta_phone_number_id', type: 'TEXT', default: null },
      { name: 'meta_connected', type: 'BOOLEAN', default: 'false' },
      { name: 'meta_connected_at', type: 'TIMESTAMP WITHOUT TIME ZONE', default: null },
      { name: 'updated_at', type: 'TIMESTAMP WITHOUT TIME ZONE', default: null }
    ];
    
    const existingColumns = columnsResult.rows.map(col => col.column_name);
    
    // Verificar e criar colunas ausentes
    for (const col of metaColumnsNeeded) {
      if (!existingColumns.includes(col.name)) {
        console.log(`\nColuna ${col.name} não existe. Adicionando...`);
        
        let query = `ALTER TABLE user_servers ADD COLUMN ${col.name} ${col.type}`;
        if (col.default !== null) {
          query += ` DEFAULT ${col.default}`;
        }
        
        await pool.query(query);
        console.log(`Coluna ${col.name} adicionada.`);
      } else {
        console.log(`Coluna ${col.name} já existe.`);
      }
    }
    
    // Testar a seleção direta das colunas
    try {
      console.log('\nTestando seleção direta das colunas meta_*...');
      
      const testResult = await pool.query(`
        SELECT id, user_id, meta_phone_number_id, meta_connected, meta_connected_at, updated_at
        FROM user_servers
        LIMIT 2
      `);
      
      console.log('Seleção bem-sucedida. Colunas existem e são acessíveis.');
      console.log('Exemplo de dados:');
      
      testResult.rows.forEach(row => {
        console.log(JSON.stringify(row, null, 2));
      });
    } catch (error) {
      console.error('Erro ao selecionar colunas meta_*:', error.message);
    }
    
    // Verificar se temos dados na tabela
    const countResult = await pool.query(`SELECT COUNT(*) FROM user_servers`);
    console.log(`\nTotal de registros na tabela: ${countResult.rows[0].count}`);
    
    // Gerar arquivo SQL com a query correta
    const scriptDir = path.dirname(__filename);
    const sqlPath = path.join(scriptDir, 'meta-queries.sql');
    
    const sqlContent = `
-- Script gerado automaticamente para acessar as colunas meta_* na tabela user_servers
-- Data da geração: ${new Date().toISOString()}

-- Selecionar todos os registros com suas colunas meta_*
SELECT us.id, us.user_id, us.server_id, us.meta_phone_number_id, us.meta_connected, us.meta_connected_at, us.updated_at
FROM user_servers us
LIMIT 10;

-- Atualizar coluna meta_phone_number_id para um usuário
UPDATE user_servers
SET meta_phone_number_id = 'test_id_' || now()::text,
    meta_connected = true,
    meta_connected_at = now(),
    updated_at = now()
WHERE user_id = 2
RETURNING id, user_id, meta_phone_number_id, meta_connected, meta_connected_at, updated_at;

-- Consultar informações do servidor para um usuário
SELECT 
  us.id, us.user_id, us.server_id, us.created_at, us.is_default,
  us.meta_phone_number_id, us.meta_connected, us.meta_connected_at, us.updated_at,
  s.id as server_id, s.name, s.ip_address, s.provider, s.api_url, s.api_token,
  s.whatsapp_meta_token, s.whatsapp_meta_business_id, s.whatsapp_meta_api_version,
  s.n8n_api_url, s.whatsapp_webhook_url
FROM user_servers us
JOIN servers s ON us.server_id = s.id
WHERE us.user_id = 2
LIMIT 1;
    `;
    
    fs.writeFileSync(sqlPath, sqlContent);
    console.log(`\nArquivo de queries SQL gerado em: ${sqlPath}`);
    
    console.log('\nVerificação concluída.');
    
  } catch (error) {
    console.error('Erro durante a execução:', error);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error('Erro na execução do script:', error);
  process.exit(1);
});