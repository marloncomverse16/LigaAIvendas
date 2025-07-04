/**
 * Teste direto do sistema de webhook QR Code
 * Importa e executa o teste de webhook diretamente
 */

import { testWebhookForUser } from './server/api/qr-connection-monitor';

async function runWebhookTest() {
  console.log('🧪 Iniciando teste direto do webhook...');
  
  try {
    // Testar webhook para usuário admin (ID 2)
    console.log('📤 Forçando teste de webhook para usuário admin (ID: 2)...');
    const result = await testWebhookForUser(2);
    
    console.log(`✅ Teste concluído! Estado detectado: ${result ? 'CONECTADO' : 'DESCONECTADO'}`);
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Executar teste
runWebhookTest();