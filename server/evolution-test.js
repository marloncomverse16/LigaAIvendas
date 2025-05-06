import { WebSocket } from 'ws';
import axios from 'axios';

console.log('Iniciando teste de conexão com a Evolution API...');

// Função para testar a conexão HTTP primeiro
async function testHTTPConnection() {
  try {
    console.log('Testando conexão HTTP com a API...');
    const response = await axios.get('https://api.primerastreadores.com', {
      headers: {
        Authorization: 'Bearer 4db623449606bcf2814521b73657dbc0'
      }
    });
    console.log('Resposta HTTP:', response.status, response.statusText);
    console.log('Dados:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('Erro na conexão HTTP:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

// Função para testar a conexão WebSocket
function testWebSocketConnection() {
  console.log('Testando conexão WebSocket...');
  
  // Convertendo o manager URL de http para wss
  // De: "manager": "http://api.primerastreadores.com/manager"
  const wsUrl = 'wss://api.primerastreadores.com/manager';
  console.log('Tentando conectar em:', wsUrl);
  
  const socket = new WebSocket(wsUrl, {
    headers: {
      Authorization: 'Bearer 4db623449606bcf2814521b73657dbc0',
    }
  });

  socket.on('open', () => {
    console.log('✅ WebSocket conectado com sucesso!');

    // Enviar mensagem de teste para verificar conexão
    const payload = {
      event: 'send-message',
      data: {
        phone: '5599999999999', // Use DDI + DDD + número (exemplo)
        message: 'Olá! Testando integração com a Evolution API. 😉'
      }
    };

    socket.send(JSON.stringify(payload));
    
    // Testar criar instância
    const createInstancePayload = {
      event: 'create-instance',
      data: {
        instanceName: 'admin'
      }
    };
    
    socket.send(JSON.stringify(createInstancePayload));
    
    // Definir timeout para fechar a conexão
    setTimeout(() => {
      console.log('Fechando conexão após 10 segundos...');
      socket.close();
    }, 10000);
  });

  socket.on('message', (data) => {
    console.log('📩 Mensagem recebida:', data.toString());
    try {
      const jsonData = JSON.parse(data.toString());
      console.log('Dados JSON:', JSON.stringify(jsonData, null, 2));
    } catch (e) {
      console.log('Não foi possível converter para JSON');
    }
  });

  socket.on('error', (err) => {
    console.error('❌ Erro na conexão WebSocket:', err.message);
  });

  socket.on('close', (code, reason) => {
    console.log(`🔌 Conexão WebSocket encerrada. Código: ${code}, Razão: ${reason || 'N/A'}`);
  });
}

// Executar os testes
async function runTests() {
  const httpSuccess = await testHTTPConnection();
  if (httpSuccess) {
    console.log('Conexão HTTP bem-sucedida, testando WebSocket...');
    testWebSocketConnection();
  } else {
    console.log('Conexão HTTP falhou, verifique credenciais e servidor.');
  }
}

runTests();