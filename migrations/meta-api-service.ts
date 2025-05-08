/**
 * Serviço para gerenciar a conexão com a Meta API usando SQL nativo
 * Este módulo contorna o ORM Drizzle para evitar problemas com as colunas meta_*
 */

import pg from 'pg';
const { Pool } = pg;

// Usar uma conexão direta com o banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function updateMetaPhoneNumberId(userId: number, phoneNumberId: string) {
  try {
    console.log(`Atualizando phoneNumberId para usuário ${userId} com valor ${phoneNumberId}`);
    
    const result = await pool.query(`
      UPDATE user_servers 
      SET meta_phone_number_id = $1, 
          meta_connected = true, 
          meta_connected_at = NOW(),
          updated_at = NOW()
      WHERE user_id = $2
      RETURNING *
    `, [phoneNumberId, userId]);
    
    console.log('Resultado da atualização:', result.rows[0]);
    
    return { success: true, updatedServer: result.rows[0] };
  } catch (error: any) {
    console.error('Erro ao atualizar meta_phone_number_id:', error);
    return { success: false, error: error.message };
  }
}

async function main() {
  // Verificar se a tabela user_servers tem as colunas necessárias
  try {
    console.log('Verificando schema da tabela...');
    
    const columns = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'user_servers'
      ORDER BY ordinal_position
    `);
    
    console.log('Colunas na tabela user_servers:');
    columns.rows.forEach((col: any) => {
      console.log(`${col.column_name}: ${col.data_type} ${col.column_default ? '(default: ' + col.column_default + ')' : ''}`);
    });
    
    // Testar com um usuário real que existe na tabela
    const userId = 2;
    const testPhoneId = 'test_phone_id_' + Date.now();
    
    console.log(`\nTestando atualização para usuário ${userId} com phoneNumberId ${testPhoneId}...`);
    const updateResult = await updateMetaPhoneNumberId(userId, testPhoneId);
    
    console.log('Resultado do teste:', updateResult);
    
  } catch (error: any) {
    console.error('Erro durante o teste:', error);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Erro na execução:', err);
});