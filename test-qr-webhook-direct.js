/**
 * Teste direto da função de webhook QR Code
 */

import { sendQRConnectionWebhook } from './server/api/qr-connection-webhook.js';

async function testQRWebhook() {
  console.log('🧪 Testando webhook QR Code diretamente...');
  
  try {
    const result = await sendQRConnectionWebhook(2); // ID do usuário admin
    
    if (result) {
      console.log('✅ Webhook enviado com sucesso!');
    } else {
      console.log('❌ Webhook falhou!');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

// Executar teste
testQRWebhook();