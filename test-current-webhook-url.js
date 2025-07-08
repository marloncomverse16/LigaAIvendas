/**
 * Teste para verificar qual URL de webhook está sendo usado atualmente
 */

import pg from 'pg';
const { Pool } = pg;

// Configuração do banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testCurrentWebhookUrl() {
  console.log("🔍 Verificando URL atual do webhook...");
  
  try {
    const userId = 2;
    
    // Buscar URL do webhook do servidor do usuário
    const query = `
      SELECT 
        s.id as server_id,
        s.name as server_name,
        s.whatsapp_webhook_url as current_webhook_url,
        us.user_id
      FROM user_servers us
      JOIN servers s ON us.server_id = s.id
      WHERE us.user_id = $1
        AND s.active = true
      LIMIT 1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      console.log(`❌ Nenhum servidor encontrado para usuário ${userId}`);
      return;
    }

    const server = result.rows[0];
    
    console.log("📋 Informações do servidor:");
    console.log(`   - Server ID: ${server.server_id}`);
    console.log(`   - Server Name: ${server.server_name}`);
    console.log(`   - User ID: ${server.user_id}`);
    console.log(`   - Current Webhook URL: ${server.current_webhook_url || 'NÃO CONFIGURADO'}`);

  } catch (error) {
    console.error('❌ Erro ao verificar webhook URL:', error);
  } finally {
    await pool.end();
  }
}

// Executar o teste
testCurrentWebhookUrl()
  .then(() => {
    console.log(`\n✅ Verificação concluída`);
    process.exit(0);
  })
  .catch(error => {
    console.error("💥 Erro fatal:", error);
    process.exit(1);
  });