/**
 * Teste manual do sistema de webhook QR Code
 * Força um teste de webhook para verificar se está funcionando
 */

import { testWebhookForUser } from './server/api/qr-connection-monitor.js';

async function testManualWebhook() {
  console.log('🧪 Iniciando teste manual do webhook...');
  
  try {
    // Testar webhook para usuário admin (ID 2)
    const result = await testWebhookForUser(2);
    
    console.log(`✅ Teste concluído! Estado atual: ${result ? 'CONECTADO' : 'DESCONECTADO'}`);
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Executar teste
testManualWebhook();