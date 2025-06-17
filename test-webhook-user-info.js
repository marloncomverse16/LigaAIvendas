/**
 * Teste do webhook Meta com informações completas do usuário
 * Verifica se user_id, user_name e headers estão sendo enviados corretamente
 */

import axios from 'axios';

async function testWebhookWithUserInfo() {
  console.log('🧪 Testando webhook Meta com informações do usuário...\n');

  // Payload simulando mensagem WhatsApp Cloud recebida
  const webhookPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "447655647302068",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15551234567",
                phone_number_id: "464298820085248" // phone_number_id do usuário admin
              },
              messages: [
                {
                  from: "5511999998888",
                  id: "wamid.HBgNNTUxMTk5OTk5ODg4OBUCABIYFjNFQjBDQzM1RjE4MEU4Nzk5NzlGAA==",
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: {
                    body: "Teste com informações do usuário incluindo nome"
                  },
                  type: "text"
                }
              ]
            },
            field: "messages"
          }
        ]
      }
    ]
  };

  try {
    console.log('📤 Enviando payload para webhook Meta...');
    console.log('📍 URL: http://localhost:5000/api/meta-webhook');
    console.log('📋 Payload:', JSON.stringify(webhookPayload, null, 2));

    const response = await axios.post('http://localhost:5000/api/meta-webhook', webhookPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log('\n✅ Webhook processado com sucesso!');
    console.log(`📊 Status: ${response.status}`);
    console.log(`📋 Resposta: ${response.data || 'OK'}`);

    console.log('\n🔍 Verificando logs do servidor para confirmar:');
    console.log('- user_id incluído no payload');
    console.log('- user_name incluído no payload');
    console.log('- Headers X-User-ID e X-User-Name enviados');
    console.log('- Encaminhamento para agente IA específico');

  } catch (error) {
    console.error('\n❌ Erro ao testar webhook:', error.message);
    
    if (error.response) {
      console.error(`📊 Status: ${error.response.status}`);
      console.error(`📋 Dados: ${error.response.data}`);
    }
  }
}

// Executar teste
testWebhookWithUserInfo();