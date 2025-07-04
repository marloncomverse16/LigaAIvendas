/**
 * Teste do endpoint de webhook QR Code
 */

import axios from 'axios';

async function testWebhookEndpoint() {
  try {
    console.log('🔐 Fazendo login primeiro...');
    
    // Fazer login
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    }, {
      withCredentials: true
    });
    
    // Obter cookies de autenticação
    const cookies = loginResponse.headers['set-cookie'];
    const cookieString = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';
    
    console.log('✅ Login realizado com sucesso');
    console.log('🍪 Cookies:', cookieString);
    
    // Testar webhook de conexão
    console.log('\n🧪 Testando webhook de CONEXÃO...');
    
    const connectResponse = await axios.post('http://localhost:5000/api/test/qr-connection', {
      action: 'connect'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieString
      }
    });
    
    console.log('✅ Resposta de conexão:', connectResponse.data);
    
    // Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Testar webhook de desconexão
    console.log('\n🧪 Testando webhook de DESCONEXÃO...');
    
    const disconnectResponse = await axios.post('http://localhost:5000/api/test/qr-connection', {
      action: 'disconnect'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieString
      }
    });
    
    console.log('✅ Resposta de desconexão:', disconnectResponse.data);
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.response?.data || error.message);
  }
}

// Executar teste
testWebhookEndpoint();