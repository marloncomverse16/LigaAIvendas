/**
 * Script para testar diferentes endpoints da Evolution API
 * Para identificar quais funcionam com as credenciais atuais
 */

import axios from 'axios';

const API_URL = 'https://api.primerastreadores.com';
const API_TOKEN = '0f9e7d76866fd738dbed11acfcef1403';
const INSTANCE = 'admin';

async function testEndpoint(method, path, name) {
  try {
    const url = `${API_URL}${path}`;
    console.log(`\n🔍 ${method.toUpperCase()} ${url} (${name})`);
    
    const config = {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    };
    
    let response;
    if (method === 'get') {
      response = await axios.get(url, config);
    } else if (method === 'post') {
      const data = {
        instanceName: INSTANCE,
        token: API_TOKEN,
        qrcode: true
      };
      response = await axios.post(url, data, config);
    }
    
    console.log(`✅ Status: ${response.status}`);
    
    if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
      console.log('❌ Retornou HTML (problema de rota)');
    } else {
      console.log('📋 Resposta:', JSON.stringify(response.data, null, 2).substring(0, 300) + '...');
    }
    
  } catch (error) {
    const status = error.response?.status || 'N/A';
    const message = error.response?.data?.response?.message || error.message;
    console.log(`❌ ${status}: ${message}`);
  }
}

async function testCreateInstance() {
  console.log('\n🚀 TESTANDO CRIAÇÃO DE INSTÂNCIA COM DIFERENTES PAYLOADS');
  
  const payloads = [
    {
      name: 'Payload Básico',
      data: {
        instanceName: INSTANCE
      }
    },
    {
      name: 'Payload Completo',
      data: {
        instanceName: INSTANCE,
        token: API_TOKEN,
        webhook: null,
        webhookByEvents: false,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        qrcodeImage: true
      }
    },
    {
      name: 'Payload Mínimo com QR',
      data: {
        instanceName: INSTANCE,
        qrcode: true
      }
    }
  ];
  
  for (const payload of payloads) {
    try {
      console.log(`\n📡 Testando: ${payload.name}`);
      const response = await axios.post(`${API_URL}/instance/create`, payload.data, {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      
      console.log(`✅ Sucesso: ${response.status}`);
      console.log('📋 Resposta:', JSON.stringify(response.data, null, 2));
      
      // Se criou com sucesso, tentar QR code
      console.log('🔍 Testando QR code após criação...');
      const qrResponse = await axios.get(`${API_URL}/instance/connect/${INSTANCE}`, {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✅ QR Status: ${qrResponse.status}`);
      console.log('📱 QR Data:', JSON.stringify(qrResponse.data, null, 2));
      
      return; // Parar no primeiro sucesso
      
    } catch (error) {
      const status = error.response?.status || 'N/A';
      const message = error.response?.data?.response?.message || error.message;
      console.log(`❌ ${payload.name} falhou: ${status} - ${message}`);
    }
  }
}

async function main() {
  console.log('🔧 DIAGNÓSTICO COMPLETO DA EVOLUTION API');
  console.log('=' .repeat(50));
  
  // Testar endpoints básicos
  await testEndpoint('get', '/', 'Root API');
  await testEndpoint('get', '/health', 'Health Check');
  await testEndpoint('get', '/instance/fetchInstances', 'Lista Instâncias');
  
  // Testar endpoints específicos da instância
  await testEndpoint('get', `/instance/${INSTANCE}`, 'Info da Instância');
  await testEndpoint('get', `/instance/connectionState/${INSTANCE}`, 'Estado da Conexão');
  await testEndpoint('get', `/instance/connect/${INSTANCE}`, 'QR Code');
  
  // Testar criação
  await testCreateInstance();
  
  console.log('\n✅ Diagnóstico concluído');
}

main();