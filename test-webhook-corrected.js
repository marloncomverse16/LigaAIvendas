import axios from 'axios';

async function testCorrectedWebhook() {
  try {
    console.log('🔄 Testando sistema de webhook corrigido...');
    
    const webhookPayload = {
      object: "whatsapp_business_account",
      entry: [{
        id: "WHATSAPP_BUSINESS_ACCOUNT_ID",
        changes: [{
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15550559999",
              phone_number_id: "629117870289911"
            },
            messages: [{
              from: "554391142751",
              id: "wamid.test123456789_with_user_id",
              timestamp: Math.floor(Date.now() / 1000).toString(),
              text: {
                body: "Teste com ID do usuário - deve incluir user_id: 2 no payload"
              },
              type: "text"
            }]
          },
          field: "messages"
        }]
      }]
    };

    console.log('📤 Enviando payload para webhook Meta corrigido...');
    
    const response = await axios.post('http://localhost:5000/api/meta-webhook', webhookPayload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Meta-Test-Client/1.0'
      },
      timeout: 15000
    });
    
    console.log(`✅ Webhook processado com sucesso`);
    console.log(`📊 Status: ${response.status}`);
    
  } catch (error) {
    console.error('❌ Erro no teste de webhook:', error);
    
    if (axios.isAxiosError(error)) {
      console.error(`📡 Status: ${error.response?.status}`);
      console.error(`📡 Dados: ${JSON.stringify(error.response?.data, null, 2)}`);
    }
  }
}

testCorrectedWebhook();