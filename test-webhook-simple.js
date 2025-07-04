/**
 * Teste simples do sistema de webhook usando SQL direto
 */

import axios from 'axios';
import pg from 'pg';
const { Pool } = pg;

// Configuração do banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testWebhookSystem() {
  console.log('🧪 Testando sistema de webhook QR Code...\n');

  try {
    // Buscar informações do usuário admin
    const userQuery = `
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.username as user_username,
        sa.name as agent_name,
        s.name as server_name,
        s.ai_agent_webhook_url as webhook_url,
        sa.webhook_url as agent_webhook_url,
        sa.cloud_webhook_url as agent_cloud_webhook_url
      FROM users u
      LEFT JOIN user_servers us ON u.id = us.user_id
      LEFT JOIN servers s ON us.server_id = s.id
      LEFT JOIN user_ai_agents ua ON u.id = ua.user_id
      LEFT JOIN server_ai_agents sa ON ua.agent_id = sa.id
      WHERE u.id = 2
        AND s.active = true
        AND s.ai_agent_webhook_url IS NOT NULL
      LIMIT 1
    `;

    const result = await pool.query(userQuery);

    if (result.rows.length === 0) {
      console.log('❌ Nenhuma configuração encontrada para usuário admin');
      console.log('   Verifique se existe:');
      console.log('   - Usuário com ID 1');
      console.log('   - Servidor ativo configurado');
      console.log('   - URL de webhook configurada');
      return;
    }

    const userData = result.rows[0];
    console.log('📋 Dados encontrados:');
    console.log(`   - Usuário: ${userData.user_name || userData.user_username}`);
    console.log(`   - Agente: ${userData.agent_name || 'Não configurado'}`);
    console.log(`   - Servidor: ${userData.server_name}`);
    console.log(`   - Webhook URL: ${userData.webhook_url}`);
    console.log(`   - Agent Webhook URL: ${userData.agent_webhook_url || 'Não configurado'}`);
    console.log(`   - Agent Cloud Webhook URL: ${userData.agent_cloud_webhook_url || 'Não configurado'}\n`);

    // Preparar payload do webhook
    const payload = {
      event: 'qr_code_connected',
      data: {
        userId: userData.user_id,
        userName: userData.user_name || userData.user_username,
        agentName: userData.agent_name || 'Agente não configurado',
        serverName: userData.server_name,
        connected: true,
        timestamp: new Date().toISOString(),
        webhookUrl: userData.agent_webhook_url,
        cloudWebhookUrl: userData.agent_cloud_webhook_url
      }
    };

    console.log('📤 Enviando webhook de teste...');
    console.log('📋 Payload:', JSON.stringify(payload, null, 2));

    // Tentar enviar webhook
    const response = await axios.post(userData.webhook_url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LigAI-QRConnection-Webhook-Test/1.0'
      },
      timeout: 10000
    });

    if (response.status >= 200 && response.status < 300) {
      console.log('✅ Webhook enviado com sucesso!');
      console.log(`📊 Status: ${response.status} - ${response.statusText}`);
      console.log(`📥 Resposta: ${JSON.stringify(response.data, null, 2)}`);
    } else {
      console.log(`⚠️ Webhook retornou status não esperado: ${response.status}`);
    }

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    
    if (axios.isAxiosError(error)) {
      console.error(`   - Status: ${error.response?.status}`);
      console.error(`   - URL: ${error.config?.url}`);
      console.error(`   - Timeout: ${error.code === 'ECONNABORTED' ? 'Sim' : 'Não'}`);
    }
  } finally {
    await pool.end();
  }
}

// Executar teste
testWebhookSystem().then(() => {
  console.log('\n🏁 Teste finalizado.');
});