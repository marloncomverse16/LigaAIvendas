/**
 * Teste do sistema automático de webhook QR Code
 * Verifica se mudanças de estado são detectadas automaticamente
 */

import axios from 'axios';

// URL base da aplicação
const BASE_URL = 'http://localhost:5000';

// Cookie de autenticação
const AUTH_COOKIE = 'connect.sid=s%3AVaQ9n0e2HZaH-JhBQcRH-FxjrK5cAa3t.BxCz0bqPGzWZLtqD4wuTPe2TVaQM9vSJh82U%2Fa8%2Fkpw';

/**
 * Faz uma requisição autenticada para a API
 */
async function apiRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Cookie': AUTH_COOKIE,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Erro na requisição ${method} ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Monitora mudanças de estado verificando várias vezes seguidas
 */
async function monitorConnectionChanges() {
  console.log('🔍 Iniciando monitoramento de mudanças de estado...');
  
  let lastState = null;
  let changeCount = 0;
  
  for (let i = 0; i < 20; i++) {
    try {
      console.log(`📊 Verificação ${i + 1}/20...`);
      
      const status = await apiRequest('GET', '/api/connections/status');
      const currentState = status.connected;
      
      console.log(`Estado atual: ${currentState ? 'CONECTADO' : 'DESCONECTADO'}`);
      
      if (lastState !== null && lastState !== currentState) {
        changeCount++;
        console.log(`🔄 MUDANÇA DETECTADA #${changeCount}: ${lastState} → ${currentState}`);
        
        if (currentState) {
          console.log('✅ Estado mudou para CONECTADO - webhook de conexão deve ser disparado');
        } else {
          console.log('❌ Estado mudou para DESCONECTADO - webhook de desconexão deve ser disparado');
        }
        
        // Aguardar um pouco para dar tempo do webhook ser processado
        console.log('⏳ Aguardando processamento do webhook...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      lastState = currentState;
      
      // Aguardar antes da próxima verificação
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Erro na verificação ${i + 1}:`, error.message);
    }
  }
  
  console.log(`📈 Monitoramento concluído. Total de mudanças detectadas: ${changeCount}`);
  
  if (changeCount === 0) {
    console.log('ℹ️ Nenhuma mudança de estado detectada durante o monitoramento');
    console.log('💡 Para testar, tente desconectar e reconectar o WhatsApp no aplicativo');
  }
}

/**
 * Testa o webhook manual para comparação
 */
async function testManualWebhook() {
  console.log('\n🧪 Testando webhook manual para comparação...');
  
  try {
    console.log('📤 Enviando webhook de conexão manual via API...');
    
    // Fazer uma requisição POST para simular webhook manual
    const webhookData = {
      event: "qr_code_connected",
      userId: 2,
      userName: "admin",
      connected: true,
      timestamp: new Date().toISOString()
    };
    
    // URL do webhook configurado
    const webhookUrl = "https://hook.eu2.make.com/ynjpn1cmmql7h8qgl5pn4oa7zc5y7o8f";
    
    const response = await axios.post(webhookUrl, webhookData, {
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': '2',
        'X-User-Name': 'admin'
      },
      timeout: 10000
    });
    
    console.log('✅ Webhook manual enviado com sucesso');
    console.log('📊 Status:', response.status);
    
  } catch (error) {
    console.error('❌ Erro ao enviar webhook manual:', error.message);
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 TESTE DO SISTEMA AUTOMÁTICO DE WEBHOOK QR CODE');
  console.log('================================================');
  
  // Verificar estado inicial
  try {
    const initialStatus = await apiRequest('GET', '/api/connections/status');
    console.log(`📊 Estado inicial: ${initialStatus.connected ? 'CONECTADO' : 'DESCONECTADO'}`);
  } catch (error) {
    console.error('❌ Erro ao verificar estado inicial:', error.message);
    return;
  }
  
  // Executar teste manual primeiro
  await testManualWebhook();
  
  // Aguardar um pouco
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Monitorar mudanças automáticas
  await monitorConnectionChanges();
  
  console.log('\n✅ Teste concluído!');
}

// Executar teste
main().catch(console.error);