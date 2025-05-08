/**
 * Este script é usado para garantir que as colunas meta_* estejam corretamente definidas na tabela user_servers
 */

import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixMetaColumns() {
  try {
    console.log('Verificando e corrigindo colunas meta_* na tabela user_servers...');
    
    // 1. Verificar se as colunas meta_* existem no information_schema
    const checkColumnsResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_servers'
      AND column_name IN ('meta_phone_number_id', 'meta_connected', 'meta_connected_at', 'updated_at')
    `);
    
    const existingColumns = checkColumnsResult.rows.map(row => row.column_name);
    console.log('Colunas encontradas:', existingColumns);
    
    // 2. Adicionar colunas que não existem
    const requiredColumns = [
      { name: 'meta_phone_number_id', type: 'TEXT', default: null },
      { name: 'meta_connected', type: 'BOOLEAN', default: 'false' },
      { name: 'meta_connected_at', type: 'TIMESTAMP WITH TIME ZONE', default: null },
      { name: 'updated_at', type: 'TIMESTAMP WITH TIME ZONE', default: null }
    ];
    
    for (const column of requiredColumns) {
      if (!existingColumns.includes(column.name)) {
        console.log(`Adicionando coluna ${column.name}...`);
        
        let query = `ALTER TABLE user_servers ADD COLUMN ${column.name} ${column.type}`;
        if (column.default !== null) {
          query += ` DEFAULT ${column.default}`;
        }
        
        await pool.query(query);
        console.log(`Coluna ${column.name} adicionada com sucesso.`);
      } else {
        console.log(`Coluna ${column.name} já existe.`);
      }
    }
    
    // 3. Verificar novamente para confirmar que todas as colunas agora existem
    const verifyResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_servers'
      AND column_name IN ('meta_phone_number_id', 'meta_connected', 'meta_connected_at', 'updated_at')
    `);
    
    console.log('Colunas após correção:');
    verifyResult.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type})`);
    });
    
    // 4. Testar operações básicas nas colunas
    console.log('Testando operações nas colunas meta_*...');

    // 4.1 Testar SELECT
    const selectResult = await pool.query(`
      SELECT id, user_id, meta_phone_number_id, meta_connected, meta_connected_at, updated_at
      FROM user_servers
      LIMIT 3
    `);
    
    console.log('Dados atuais (primeiros 3 registros):');
    selectResult.rows.forEach(row => {
      console.log(JSON.stringify(row));
    });
    
    // 4.2 Testar UPDATE em um registro existente para usuário com ID 2 (geralmente o admin)
    try {
      const updateResult = await pool.query(`
        UPDATE user_servers
        SET meta_phone_number_id = 'test_id_' || now()::text,
            meta_connected = true,
            meta_connected_at = now(),
            updated_at = now()
        WHERE user_id = 2
        RETURNING id, user_id, meta_phone_number_id, meta_connected, meta_connected_at, updated_at
      `);
      
      if (updateResult.rows.length > 0) {
        console.log('Atualização bem-sucedida para o usuário 2:');
        console.log(JSON.stringify(updateResult.rows[0]));
      } else {
        console.log('Nenhum registro encontrado para o usuário 2.');
      }
    } catch (error) {
      console.error('Erro ao atualizar registro:', error.message);
    }
    
    console.log('Verificação e correção de colunas meta_* concluídas.');
  } catch (error) {
    console.error('Erro durante a execução:', error);
  } finally {
    await pool.end();
  }
}

fixMetaColumns().catch(error => {
  console.error('Erro ao executar script:', error);
});