/**
 * Teste do sistema de monitoramento automático
 * Para verificar se o webhook é disparado automaticamente
 */

import { forceConnectionCheck, getMonitoringStatus } from './server/api/qr-connection-monitor.js';

async function testAutomaticMonitoring() {
  console.log('🧪 Testando sistema de monitoramento automático...');
  
  try {
    // Verificar status atual do monitoramento
    const status = getMonitoringStatus();
    console.log('📊 Status do monitoramento:', status);
    
    // Forçar verificação manual
    console.log('🔄 Forçando verificação manual...');
    await forceConnectionCheck();
    
    console.log('✅ Teste concluído!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Executar teste
testAutomaticMonitoring();