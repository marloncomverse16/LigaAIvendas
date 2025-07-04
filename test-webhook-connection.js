/**
 * Teste do sistema de webhook automático para conexão QR Code
 * Simula uma mudança de estado e verifica se o webhook é enviado
 */

import axios from 'axios';
import { sendQRConnectionWebhook } from './server/api/qr-connection-webhook.js';

async function testWebhookConnection() {
  console.log('🧪 Iniciando teste de webhook de conexão QR Code...');
  
  const userId = 2; // ID do usuário admin
  
  try {
    // Testar envio do webhook
    console.log(`📤 Testando envio de webhook para usuário ${userId}...`);
    
    const result = await sendQRConnectionWebhook(userId);
    
    if (result) {
      console.log('✅ Webhook enviado com sucesso!');
    } else {
      console.log('❌ Falha no envio do webhook');
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

// Executar teste
testWebhookConnection();