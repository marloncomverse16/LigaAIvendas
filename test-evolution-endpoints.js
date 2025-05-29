/**
 * Script para testar diferentes endpoints da Evolution API
 * Para identificar quais funcionam com as credenciais atuais
 */

import axios from 'axios';

const API_URL = 'https://api.primerastreadores.com';
const API_TOKEN = '0f9e7d76866fd738dbed11acfcef1403';

const headers = {
  'Authorization': `Bearer ${API_TOKEN}`,
  'Content-Type': 'application/json'
};

// Lista de endpoints para testar
const endpoints = [
  // Endpoints de status da API
  { method: 'GET', path: '/', name: 'Status da API' },
  { method: 'GET', path: '/api/version', name: 'Versão da API' },
  { method: 'GET', path: '/manager', name: 'Manager' },
  
  // Endpoints de instâncias
  { method: 'GET', path: '/instances', name: 'Listar instâncias' },
  { method: 'GET', path: '/instance', name: 'Instâncias (singular)' },
  { method: 'GET', path: '/manager/instance', name: 'Manager instance' },
  
  // Endpoints específicos para admin
  { method: 'GET', path: '/instance/admin', name: 'Instância admin' },
  { method: 'GET', path: '/instances/admin', name: 'Admin instances' },
  { method: 'GET', path: '/manager/instance/admin', name: 'Manager admin' },
  
  // Endpoints de conexão
  { method: 'GET', path: '/instance/connect/admin', name: 'Conectar admin' },
  { method: 'GET', path: '/instance/admin/connect', name: 'Admin conectar' },
  { method: 'GET', path: '/manager/instance/connect/admin', name: 'Manager conectar admin' },
  
  // Endpoints de QR Code
  { method: 'GET', path: '/instance/qrcode/admin', name: 'QR Code admin' },
  { method: 'GET', path: '/qrcode/admin', name: 'QR Code direto' },
  { method: 'GET', path: '/manager/qrcode/admin', name: 'Manager QR Code' },
];

async function testEndpoint(method, path, name) {
  try {
    const url = `${API_URL}${path}`;
    console.log(`\n🔍 Testando: ${name}`);
    console.log(`   ${method} ${url}`);
    
    const response = await axios({
      method,
      url,
      headers,
      timeout: 10000
    });
    
    console.log(`   ✅ Status: ${response.status}`);
    
    // Verificar se é JSON válido
    if (typeof response.data === 'object') {
      console.log(`   📄 Tipo: JSON válido`);
      console.log(`   📋 Dados:`, JSON.stringify(response.data).substring(0, 200) + '...');
    } else if (typeof response.data === 'string') {
      if (response.data.includes('<!doctype html>') || response.data.includes('<html')) {
        console.log(`   📄 Tipo: HTML (não é API)`);
      } else {
        console.log(`   📄 Tipo: String`);
        console.log(`   📋 Dados:`, response.data.substring(0, 100) + '...');
      }
    }
    
    return { success: true, status: response.status, data: response.data };
    
  } catch (error) {
    console.log(`   ❌ Erro: ${error.response?.status || error.code} - ${error.message}`);
    return { success: false, error: error.message, status: error.response?.status };
  }
}

async function testCreateInstance() {
  console.log(`\n🔧 Testando criação de instância...`);
  
  const createData = {
    instanceName: 'admin',
    token: API_TOKEN,
    webhook: null,
    webhookByEvents: false,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true,
    qrcodeImage: true
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
      console.log(`\n   POST ${url}`);
      
      const response = await axios.post(url, createData, { headers, timeout: 15000 });
      console.log(`   ✅ Criação bem-sucedida: ${response.status}`);
      console.log(`   📋 Resposta:`, JSON.stringify(response.data).substring(0, 200) + '...');
      
      return { success: true, endpoint, data: response.data };
      
    } catch (error) {
      console.log(`   ❌ Falhou: ${error.response?.status || error.code} - ${error.message}`);
    }
  }
  
  return { success: false };
}

async function main() {
  console.log('🚀 Testando Evolution API');
  console.log(`📡 URL: ${API_URL}`);
  console.log(`🔑 Token: ${API_TOKEN.substring(0, 10)}...${API_TOKEN.substring(API_TOKEN.length - 5)}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 TESTANDO ENDPOINTS GET');
  console.log('='.repeat(60));
  
  const workingEndpoints = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint.method, endpoint.path, endpoint.name);
    
    if (result.success && result.status === 200) {
      workingEndpoints.push({
        ...endpoint,
        result
      });
    }
    
    // Pequena pausa entre requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🔧 TESTANDO CRIAÇÃO DE INSTÂNCIA');
  console.log('='.repeat(60));
  
  const createResult = await testCreateInstance();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO DOS RESULTADOS');
  console.log('='.repeat(60));
  
  if (workingEndpoints.length > 0) {
    console.log('\n✅ ENDPOINTS QUE FUNCIONAM:');
    workingEndpoints.forEach(ep => {
      console.log(`   • ${ep.method} ${ep.path} - ${ep.name}`);
    });
  } else {
    console.log('\n❌ Nenhum endpoint GET funcionou corretamente');
  }
  
  if (createResult.success) {
    console.log(`\n✅ CRIAÇÃO DE INSTÂNCIA: ${createResult.endpoint}`);
  } else {
    console.log('\n❌ Nenhum endpoint de criação funcionou');
  }
  
  console.log('\n🏁 Teste concluído!');
}

main().catch(console.error);