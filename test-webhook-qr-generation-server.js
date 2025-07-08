/**
 * Teste do webhook de geração de QR Code usando o endereço do servidor
 * (Webhook de Configuração Instancia Evolution)
 */

import { sendQRCodeGeneratedWebhook } from './server/api/qr-connection-webhook.js';

async function testQRGenerationWebhookToServer() {
  console.log("🧪 Testando webhook de geração de QR Code para Webhook de Configuração Instancia Evolution");
  console.log("📅 Timestamp:", new Date().toISOString());
  
  try {
    // Teste com usuário ID 2 (Administrador) e dados simulados de QR Code
    const userId = 2;
    const mockQrCodeData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    
    console.log(`👤 Testando com usuário ID: ${userId}`);
    console.log(`📱 QR Code data simulado: ${mockQrCodeData.substring(0, 50)}...`);
    
    const result = await sendQRCodeGeneratedWebhook(userId, mockQrCodeData);
    
    if (result) {
      console.log("✅ Teste bem-sucedido! Webhook de QR Code gerado enviado para Webhook de Configuração Instancia Evolution");
    } else {
      console.log("❌ Teste falhou! Webhook não foi enviado corretamente");
    }
    
    return result;
    
  } catch (error) {
    console.error("💥 Erro durante o teste:", error);
    return false;
  }
}

// Executar o teste
testQRGenerationWebhookToServer()
  .then(success => {
    console.log(`\n🎯 Resultado final: ${success ? 'SUCESSO' : 'FALHA'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error("💥 Erro fatal:", error);
    process.exit(1);
  });