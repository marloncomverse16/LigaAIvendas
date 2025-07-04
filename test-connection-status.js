/**
 * Teste direto do endpoint de status de conexão
 * Faz login primeiro e depois testa o status
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

async function loginAndTest() {
  try {
    console.log('🔐 Fazendo login...');
    
    // Fazer login
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    }, {
      withCredentials: true
    });
    
    console.log('✅ Login realizado com sucesso');
    
    // Extrair o cookie de sessão
    const cookies = loginResponse.headers['set-cookie'];
    const sessionCookie = cookies ? cookies.find(cookie => cookie.startsWith('connect.sid')) : null;
    
    if (!sessionCookie) {
      console.error('❌ Cookie de sessão não encontrado');
      return;
    }
    
    console.log('🍪 Cookie de sessão obtido:', sessionCookie.split(';')[0]);
    
    // Testar o status de conexão com o cookie correto
    console.log('\n📊 Testando status de conexão...');
    
    for (let i = 0; i < 5; i++) {
      try {
        const statusResponse = await axios.get(`${BASE_URL}/api/connections/status`, {
          headers: {
            'Cookie': sessionCookie.split(';')[0]
          }
        });
        
        console.log(`Teste ${i + 1}: Estado = ${statusResponse.data.connected ? 'CONECTADO' : 'DESCONECTADO'}`);
        
        // Aguardar 3 segundos entre testes
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error) {
        console.error(`❌ Erro no teste ${i + 1}:`, error.response?.data || error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro no login:', error.response?.data || error.message);
  }
}

// Executar teste
loginAndTest().catch(console.error);