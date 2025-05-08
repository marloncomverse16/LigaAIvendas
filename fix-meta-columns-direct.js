/**
 * Script para testar diretamente as colunas meta_* da tabela user_servers
 * Usando Node.js com o driver nativo pg
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

async function runTest() {
  try {
    console.log('Testando diretamente as operações meta_* com pg nativo...');
    
    // 1. Verificar usuários disponíveis
    const usersResult = await pool.query(`
      SELECT id, username, active 
      FROM users 
      ORDER BY id
      LIMIT 5
    `);
    
    console.log('\nUsuários disponíveis:');
    usersResult.rows.forEach(user => {
      console.log(`ID: ${user.id}, Username: ${user.username}, Active: ${user.active}`);
    });
    
    // 2. Verificar servidores disponíveis
    const serversResult = await pool.query(`
      SELECT id, name, whatsapp_meta_token, whatsapp_meta_business_id
      FROM servers
      ORDER BY id
      LIMIT 5
    `);
    
    console.log('\nServidores disponíveis:');
    serversResult.rows.forEach(server => {
      console.log(`ID: ${server.id}, Nome: ${server.name}`);
      console.log(`Token Meta: ${server.whatsapp_meta_token ? 'Configurado' : 'Não configurado'}`);
      console.log(`Business ID: ${server.whatsapp_meta_business_id ? 'Configurado' : 'Não configurado'}`);
    });
    
    // 3. Verificar relações user_servers
    const userServersResult = await pool.query(`
      SELECT us.id, us.user_id, us.server_id, us.meta_phone_number_id, us.meta_connected
      FROM user_servers us
      ORDER BY us.id
      LIMIT 5
    `);
    
    console.log('\nRelações user_servers:');
    userServersResult.rows.forEach(relation => {
      console.log(`ID: ${relation.id}, User ID: ${relation.user_id}, Server ID: ${relation.server_id}`);
      console.log(`Meta Phone ID: ${relation.meta_phone_number_id || 'Não configurado'}`);
      console.log(`Meta Connected: ${relation.meta_connected ? 'Sim' : 'Não'}`);
    });
    
    // 4. Testar atualização para um usuário (use o ID de um usuário existente)
    const testUserId = 2; // Altere para um ID existente conforme necessário
    
    // Verificar se o usuário tem relação com servidor
    const checkUserServer = await pool.query(`
      SELECT id FROM user_servers WHERE user_id = $1
    `, [testUserId]);
    
    if (checkUserServer.rows.length === 0) {
      console.log(`\nUsuário ${testUserId} não tem relação com servidor. Criando...`);
      
      // Criar relação com o primeiro servidor disponível
      if (serversResult.rows.length > 0) {
        const firstServerId = serversResult.rows[0].id;
        
        await pool.query(`
          INSERT INTO user_servers (user_id, server_id, is_default, created_at)
          VALUES ($1, $2, true, NOW())
        `, [testUserId, firstServerId]);
        
        console.log(`Relação criada com servidor ID ${firstServerId}`);
      } else {
        console.log('Não há servidores disponíveis para criar relação');
      }
    }
    
    // 5. Atualizar colunas meta_*
    const testPhoneId = `test_phone_${Date.now()}`;
    console.log(`\nAtualizando meta_phone_number_id para '${testPhoneId}' do usuário ${testUserId}...`);
    
    const updateResult = await pool.query(`
      UPDATE user_servers
      SET meta_phone_number_id = $1,
          meta_connected = true,
          meta_connected_at = NOW(),
          updated_at = NOW()
      WHERE user_id = $2
      RETURNING id, user_id, meta_phone_number_id, meta_connected, meta_connected_at
    `, [testPhoneId, testUserId]);
    
    if (updateResult.rows.length > 0) {
      console.log('Atualização bem-sucedida:');
      console.log(updateResult.rows[0]);
    } else {
      console.log(`Nenhum registro encontrado para o usuário ${testUserId}`);
    }
    
    // 6. Consultar dados do servidor para o usuário
    console.log('\nConsultando informações completas do servidor para o usuário...');
    
    const fullInfoResult = await pool.query(`
      SELECT 
        us.id, us.user_id, us.server_id, us.created_at, us.is_default,
        us.meta_phone_number_id, us.meta_connected, us.meta_connected_at, us.updated_at,
        s.id as server_id, s.name, s.ip_address, s.provider, s.api_url, s.api_token,
        s.whatsapp_meta_token, s.whatsapp_meta_business_id, s.whatsapp_meta_api_version,
        s.n8n_api_url, s.whatsapp_webhook_url
      FROM user_servers us
      JOIN servers s ON us.server_id = s.id
      WHERE us.user_id = $1
      LIMIT 1
    `, [testUserId]);
    
    if (fullInfoResult.rows.length > 0) {
      console.log('Informações recuperadas:');
      const row = fullInfoResult.rows[0];
      
      // Convertendo para formato mais legível
      const result = {
        userServer: {
          id: row.id,
          userId: row.user_id,
          serverId: row.server_id,
          metaPhoneNumberId: row.meta_phone_number_id,
          metaConnected: row.meta_connected,
          metaConnectedAt: row.meta_connected_at
        },
        server: {
          id: row.server_id,
          name: row.name,
          apiUrl: row.api_url,
          whatsappMetaToken: row.whatsapp_meta_token ? 'Configurado' : 'Não configurado',
          whatsappMetaBusinessId: row.whatsapp_meta_business_id ? 'Configurado' : 'Não configurado',
          whatsappMetaApiVersion: row.whatsapp_meta_api_version
        }
      };
      
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Nenhuma informação encontrada para o usuário ${testUserId}`);
    }
    
    console.log('\nTestes concluídos com sucesso.');
    
  } catch (error) {
    console.error('Erro durante a execução:', error);
  } finally {
    await pool.end();
  }
}

runTest().catch(error => {
  console.error('Erro na execução do script:', error);
  process.exit(1);
});