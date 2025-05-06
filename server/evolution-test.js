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
    
    // Testar o endpoint real da documentação
    console.log("\nVerificando documentação da API...");
    if (response.data && response.data.documentation) {
      try {
        const docUrl = response.data.documentation;
        console.log(`URL documentação: ${docUrl}`);
        const docResponse = await axios.get(docUrl);
        console.log(`Documentação status: ${docResponse.status}`);
      } catch (docError) {
        console.error(`Erro ao acessar documentação: ${docError.message}`);
      }
    }
    
    // Testar endpoints do manager
    console.log("\nVerificando endpoint do manager...");
    if (response.data && response.data.manager) {
      try {
        const managerUrl = response.data.manager;
        console.log(`URL manager: ${managerUrl}`);
        const managerResponse = await axios.get(managerUrl, {
          headers: {
            Authorization: 'Bearer 4db623449606bcf2814521b73657dbc0'
          }
        });
        console.log(`Manager status: ${managerResponse.status}`);
      } catch (managerError) {
        console.error(`Erro ao acessar manager: ${managerError.message}`);
      }
    }
    
    // Testar endpoint de instância
    console.log("\nTentando endpoints de instances/admin/qrcode...");
    try {
      const baseUrl = response.data.manager || 'https://api.primerastreadores.com';
      
      // Remover http:// ou https:// e garantir formato correto
      const cleanBaseUrl = baseUrl.replace(/^https?:\/\//, '');
      const apiUrl = `https://${cleanBaseUrl}`;
      
      // Tentando variações de endpoints para encontrar o correto
      const endpoints = [
        '/instances/admin/qrcode',
        '/instance/admin/qrcode',
        '/api/instances/admin/qrcode',
        '/manager/instances/admin/qrcode',
        '/manager/api/instances/admin/qrcode',
        '/v1/instances/admin/qrcode',
        '/v3/instances/admin/qrcode'
      ];
      
      for (const endpoint of endpoints) {
        try {
          const url = `${apiUrl}${endpoint}`;
          console.log(`Testando: ${url}`);
          
          const response = await axios.get(url, {
            headers: {
              Authorization: 'Bearer 4db623449606bcf2814521b73657dbc0'
            }
          });
          
          console.log(`✅ Sucesso! Status: ${response.status}`);
          console.log(`Dados: ${JSON.stringify(response.data, null, 2)}`);
        } catch (endpointError) {
          const status = endpointError.response ? endpointError.response.status : 'sem resposta';
          console.log(`❌ Falha. Status: ${status}`);
        }
      }
    } catch (error) {
      console.error('Erro ao testar endpoints:', error.message);
    }
    
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