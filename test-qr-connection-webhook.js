/**
 * Teste do sistema de webhook de conexão QR Code
 * Simula uma conexão bem-sucedida e verifica se o webhook é enviado
 */

import { sendQRConnectionWebhook, sendQRDisconnectionWebhook } from './server/api/qr-connection-webhook.js';

async function testQRConnectionWebhook() {
  console.log('🧪 Iniciando teste do webhook de conexão QR Code...\n');

  try {
    // Teste com usuário admin (ID 1)
    const userId = 1;
    
    console.log(`📋 Testando webhook de conexão para usuário ${userId}`);
    const connectionResult = await sendQRConnectionWebhook(userId);
    
    if (connectionResult) {
      console.log('✅ Webhook de conexão enviado com sucesso!');
    } else {
      console.log('❌ Falha no envio do webhook de conexão');
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    console.log(`📋 Testando webhook de desconexão para usuário ${userId}`);
    const disconnectionResult = await sendQRDisconnectionWebhook(userId);
    
    if (disconnectionResult) {
      console.log('✅ Webhook de desconexão enviado com sucesso!');
    } else {
      console.log('❌ Falha no envio do webhook de desconexão');
    }
    
    console.log('\n📊 Resumo dos testes:');
    console.log(`   - Webhook de conexão: ${connectionResult ? 'SUCESSO' : 'FALHA'}`);
    console.log(`   - Webhook de desconexão: ${disconnectionResult ? 'SUCESSO' : 'FALHA'}`);
    
    if (connectionResult && disconnectionResult) {
      console.log('\n🎉 Todos os testes passaram! Sistema de webhook está funcionando.');
    } else {
      console.log('\n⚠️ Alguns testes falharam. Verifique a configuração.');
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Executar teste
testQRConnectionWebhook().then(() => {
  console.log('\n🏁 Teste finalizado.');
  process.exit(0);
});