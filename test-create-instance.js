/**
 * Teste para criar a instância admin na Evolution API
 */

import axios from 'axios';

const API_URL = 'https://api.primerastreadores.com';
const API_TOKEN = '0f9e7d76866fd738dbed11acfcef1403';
const INSTANCE = 'admin';

async function testCreateInstance() {
  console.log('🔧 Testando criação da instância admin...');
  
  const createData = {
    instanceName: INSTANCE,
    token: API_TOKEN,
    webhook: null,
    webhookByEvents: false,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true,
    qrcodeImage: true,
    reject_call: false,
    events_message: false,
    ignore_group: false,
    ignore_broadcast: false,
    save_message: true,
    webhook_base64: true
  };
  
  const createEndpoints = [
    '/instance/create',
    '/instance/create/admin',
    '/manager/instance/create',
    '/manager/instance/create/admin'
  ];
  
  for (const endpoint of createEndpoints) {
    try {
      const url = `${API_URL}${endpoint}`;
      console.log(`\n📡 POST ${url}`);
      
      const response = await axios.post(url, createData, {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      
      console.log(`✅ Sucesso: ${response.status}`);
      console.log('📋 Resposta:', JSON.stringify(response.data, null, 2));
      
      // Agora testar o QR code
      console.log('\n📱 Testando QR code após criação...');
      await testQrCodeAfterCreate();
      
      return;
      
    } catch (error) {
      console.log(`❌ Falhou: ${error.response?.status || error.code} - ${error.message}`);
      if (error.response?.data) {
        console.log('📋 Dados do erro:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }
  
  console.log('❌ Nenhum endpoint de criação funcionou');
}

async function testQrCodeAfterCreate() {
  try {
    const endpoint = `${API_URL}/instance/connect/${INSTANCE}`;
    console.log(`🔍 GET ${endpoint}`);
    
    const response = await axios.get(endpoint, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log(`✅ QR Code Status: ${response.status}`);
    
    if (response.data?.qrcode || response.data?.qrCode) {
      console.log('🎉 QR CODE OBTIDO COM SUCESSO!');
      console.log('📱 QR Code:', response.data.qrcode || response.data.qrCode);
    } else {
      console.log('📋 Resposta:', JSON.stringify(response.data, null, 2));
    }
    
  } catch (error) {
    console.log(`❌ Erro QR Code: ${error.response?.status || error.code} - ${error.message}`);
    if (error.response?.data) {
      console.log('📋 Dados do erro:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testCreateInstance();