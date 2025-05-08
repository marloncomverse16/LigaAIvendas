/**
 * Este script é usado para garantir que as colunas meta_* estejam corretamente definidas na tabela user_servers
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixMetaColumns() {
  try {
    // Verificar se as colunas já existem
    const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_servers' 
        AND column_name = 'meta_phone_number_id'
    `);

    if (checkResult.rows.length === 0) {
      console.log('Adicionando coluna meta_phone_number_id à tabela user_servers');
      
      // Adicionar coluna se não existir
      await pool.query(`
        ALTER TABLE user_servers 
        ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT,
        ADD COLUMN IF NOT EXISTS meta_connected BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS meta_connected_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
      `);
      
      console.log('Colunas meta_* adicionadas com sucesso à tabela user_servers');
    } else {
      console.log('Coluna meta_phone_number_id já existe na tabela user_servers');
    }
    
    // Verificar o schema atual da tabela
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'user_servers'
      ORDER BY ordinal_position
    `);
    
    console.log('Schema atual da tabela user_servers:');
    columnsResult.rows.forEach(col => {
      console.log(`${col.column_name}: ${col.data_type} ${col.column_default ? '(default: ' + col.column_default + ')' : ''}`);
    });
    
    // Finalizar
    console.log('Verificação de schema concluída');
    
  } catch (error) {
    console.error('Erro ao verificar/atualizar colunas meta_*:', error);
  } finally {
    await pool.end();
  }
}

fixMetaColumns().catch(err => {
  console.error('Erro na execução do script:', err);
  process.exit(1);
});