/**
 * Teste direto da função sendQRCodeGeneratedWebhook
 * Para verificar se ela está funcionando corretamente
 */

import axios from 'axios';

async function testDirectWebhookCall() {
  try {
    console.log('🧪 Testando chamada direta do webhook via rota de teste');
    
    const response = await axios.post('http://localhost:5000/api/test-webhook', {
      userId: 2,
      qrCode: 'data:image/png;base64,testQRCode123'
    });
    
    console.log('✅ Resposta da rota de teste:', response.data);
    console.log('📊 Status:', response.status);
    
  } catch (error) {
    console.error('❌ Erro na chamada direta:', error.response?.data || error.message);
  }
}

testDirectWebhookCall();