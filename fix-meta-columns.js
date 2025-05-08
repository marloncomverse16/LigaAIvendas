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
    console.log('Verificando e corrigindo colunas meta_* na tabela user_servers...');
    
    // Verificar todas as colunas da tabela user_servers
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'user_servers'
      ORDER BY ordinal_position
    `);
    
    console.log('Colunas encontradas na tabela user_servers:');
    columnsResult.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}, default: ${col.column_default || 'NULL'}, nullable: ${col.is_nullable}`);
    });
    
    // Verificar o tipo OID da tabela
    const tableOidResult = await pool.query(`
      SELECT oid, relname
      FROM pg_class
      WHERE relname = 'user_servers'
    `);
    
    if (tableOidResult.rows.length === 0) {
      console.log('Tabela user_servers não encontrada!');
      return;
    }
    
    const tableOid = tableOidResult.rows[0].oid;
    console.log(`OID da tabela user_servers: ${tableOid}`);
    
    // Verificar atributos da tabela no catálogo do sistema
    const attrsResult = await pool.query(`
      SELECT attname, atttypid, attlen, attnum, attnotnull
      FROM pg_attribute
      WHERE attrelid = $1 AND attnum > 0 AND NOT attisdropped
      ORDER BY attnum
    `, [tableOid]);
    
    console.log('\nAtributos no catálogo do sistema:');
    attrsResult.rows.forEach(attr => {
      console.log(`- ${attr.attname}: typeid=${attr.atttypid}, num=${attr.attnum}, notnull=${attr.attnotnull}`);
    });
    
    // Verificar se existem dados na tabela
    const countResult = await pool.query('SELECT COUNT(*) FROM user_servers');
    console.log(`\nTotal de registros na tabela: ${countResult.rows[0].count}`);
    
    if (parseInt(countResult.rows[0].count) > 0) {
      console.log('\nAmostra de dados:');
      const sampleData = await pool.query('SELECT * FROM user_servers LIMIT 3');
      sampleData.rows.forEach((row, index) => {
        console.log(`\nRegistro ${index + 1}:`);
        Object.keys(row).forEach(key => {
          console.log(`  ${key}: ${row[key]}`);
        });
      });
    }
    
    // Verificar meta_phone_number_id especificamente
    try {
      console.log('\nTestando consulta direta à coluna meta_phone_number_id:');
      const testResult = await pool.query('SELECT id, user_id, meta_phone_number_id FROM user_servers LIMIT 2');
      testResult.rows.forEach(row => {
        console.log(`ID: ${row.id}, UserID: ${row.user_id}, MetaPhoneNumberID: ${row.meta_phone_number_id || 'NULL'}`);
      });
      console.log('Consulta bem-sucedida. A coluna meta_phone_number_id é acessível.');
    } catch (error) {
      console.error('Erro ao consultar meta_phone_number_id:', error.message);
      
      // Tentar corrigir a coluna se não existir
      if (error.message.includes('column "meta_phone_number_id" does not exist')) {
        console.log('\nTentando corrigir coluna meta_phone_number_id...');
        await pool.query(`ALTER TABLE user_servers ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT`);
        console.log('Coluna adicionada. Verificando novamente...');
        
        try {
          const verifyResult = await pool.query('SELECT id, meta_phone_number_id FROM user_servers LIMIT 1');
          console.log('Agora a coluna está acessível.');
        } catch (verifyError) {
          console.error('Ainda com problemas após tentar corrigir:', verifyError.message);
        }
      }
    }
    
    console.log('\nVerificação concluída.');
    
  } catch (error) {
    console.error('Erro durante a verificação:', error);
  } finally {
    await pool.end();
  }
}

fixMetaColumns().catch(error => {
  console.error('Erro na execução do script:', error);
});