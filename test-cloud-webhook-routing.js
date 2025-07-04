/**
 * Teste do sistema de roteamento inteligente de webhooks Cloud API
 * Demonstra como o sistema agora prioriza cloudWebhookUrl para mensagens Cloud API
 */

import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function testCloudWebhookRouting() {
  console.log('🧪 Testando sistema de roteamento de webhooks Cloud API\n');

  try {
    // Simular a mesma query que o sistema real usa
    const testPhoneNumberId = '374454755761507'; // Phone Number ID de exemplo
    
    const userAgentQuery = `
      SELECT 
        us.user_id,
        u.name as user_name,
        u.username as user_username,
        COALESCE(sa.cloud_webhook_url, sa.webhook_url) as ai_agent_webhook_url,
        sa.cloud_webhook_url,
        sa.webhook_url,
        sa.name as ai_agent_name
      FROM user_servers us
      JOIN users u ON us.user_id = u.id
      JOIN user_ai_agents ua ON us.user_id = ua.user_id
      JOIN server_ai_agents sa ON ua.agent_id = sa.id
      WHERE us.meta_phone_number_id = $1
        AND us.meta_connected = true
        AND sa.active = true
      LIMIT 1
    `;

    console.log('🔍 Executando query de busca...');
    const result = await pool.query(userAgentQuery, [testPhoneNumberId]);

    if (result.rows.length === 0) {
      console.log('⚠️  Nenhum agente IA encontrado para este phone_number_id');
      console.log('📝 Para testar, você pode:');
      console.log('   1. Configurar um agente IA para o usuário');
      console.log('   2. Associar o agente ao usuário via user_ai_agents');
      console.log('   3. Configurar o phone_number_id no user_servers');
      return;
    }

    const row = result.rows[0];
    console.log('✅ Resultado encontrado:');
    console.log(`   👤 Usuário: ${row.user_name} (ID: ${row.user_id})`);
    console.log(`   🤖 Agente IA: ${row.ai_agent_name}`);
    console.log(`   🔗 Webhook padrão: ${row.webhook_url || 'Não configurado'}`);
    console.log(`   🌐 Webhook Cloud: ${row.cloud_webhook_url || 'Não configurado'}`);
    console.log(`   📍 Webhook selecionado: ${row.ai_agent_webhook_url}`);

    console.log('\n📊 Análise do roteamento:');
    if (row.cloud_webhook_url) {
      console.log('✅ Sistema usará o Webhook Cloud (prioridade)');
      console.log('   Mensagens Cloud API → Webhook Cloud específico');
    } else if (row.webhook_url) {
      console.log('⚠️  Sistema usará o Webhook padrão (fallback)');
      console.log('   Webhook Cloud não configurado, usando padrão');
    } else {
      console.log('❌ Nenhum webhook configurado');
    }

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  } finally {
    await pool.end();
  }
}

testCloudWebhookRouting();