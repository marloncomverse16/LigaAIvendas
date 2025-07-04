/**
 * Teste direto da função de webhook QR Code
 */

async function testQRWebhook() {
  try {
    console.log('🧪 Testando função de webhook QR Code diretamente...');
    
    // Importar função de webhook
    const { sendQRConnectionWebhook } = await import('./server/api/qr-connection-webhook');
    
    // Testar para o usuário admin (ID 2)
    const userId = 2;
    
    console.log(`📤 Disparando webhook de conexão para usuário ${userId}...`);
    
    const result = await sendQRConnectionWebhook(userId);
    
    console.log('✅ Resultado do webhook:', result);
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Executar teste
testQRWebhook();