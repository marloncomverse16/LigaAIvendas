/**
 * Teste para verificar o webhook de geração de QR Code
 * Simula uma geração de QR Code e verifica se o webhook é enviado
 */

const { pool } = await import('./server/db.ts');

async function testQRWebhookGeneration() {
  try {
    console.log("🧪 Testando webhook de geração de QR Code...");
    
    // Importar a função de webhook
    const { sendQRCodeGeneratedWebhook } = await import('./server/api/qr-connection-webhook.js');
    
    // Dados de teste
    const userId = 2; // Usuário admin
    const qrCodeData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAKGklEQVR4Xu3dQY4URxqA4f+example...";
    
    console.log(`📱 Testando webhook para usuário ${userId}`);
    console.log(`📊 QR Code simulado: ${qrCodeData.substring(0, 50)}...`);
    
    // Enviar webhook
    const result = await sendQRCodeGeneratedWebhook(userId, qrCodeData);
    
    if (result) {
      console.log("✅ Webhook enviado com sucesso!");
    } else {
      console.log("❌ Falha ao enviar webhook");
    }
    
    // Verificar dados no banco
    const query = `
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.username as user_username,
        sa.name as agent_name,
        sa.webhook_url,
        sa.cloud_webhook_url,
        s.name as server_name
      FROM users u
      LEFT JOIN user_servers us ON u.id = us.user_id
      LEFT JOIN servers s ON us.server_id = s.id
      LEFT JOIN user_ai_agents ua ON u.id = ua.user_id
      LEFT JOIN server_ai_agents sa ON ua.agent_id = sa.id
      WHERE u.id = $1
        AND s.active = true
        AND sa.active = true
    `;
    
    const dbResult = await pool.query(query, [userId]);
    
    if (dbResult.rows.length > 0) {
      const row = dbResult.rows[0];
      console.log("📋 Dados encontrados no banco:");
      console.log(`   - ID do Usuário: ${row.user_id}`);
      console.log(`   - Nome do Usuário: ${row.user_name}`);
      console.log(`   - Username: ${row.user_username}`);
      console.log(`   - Nome do Agente: ${row.agent_name}`);
      console.log(`   - URL Webhook: ${row.webhook_url}`);
      console.log(`   - URL Webhook Cloud: ${row.cloud_webhook_url}`);
      console.log(`   - Nome do Servidor: ${row.server_name}`);
    } else {
      console.log("❌ Nenhum dado encontrado no banco para este usuário");
    }
    
  } catch (error) {
    console.error("❌ Erro no teste:", error);
  } finally {
    process.exit(0);
  }
}

testQRWebhookGeneration();