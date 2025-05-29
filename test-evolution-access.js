/**
 * Script para testar acesso direto à Evolution API
 * Este script testa diferentes rotas e verbos para encontrar a combinação certa
 */

import axios from 'axios';

const API_URL = 'https://api.primerastreadores.com';
const API_TOKEN = '0f9e7d76866fd738dbed11acfcef1403';
const INSTANCE = 'admin';

async function testEndpoint(method, url, data = null) {
  const authHeaders = [
    { 'Authorization': `Bearer ${API_TOKEN}` },
    { 'apikey': API_TOKEN },
    { 'x-api-key': API_TOKEN },
    { 'Authentication': API_TOKEN },
    { 'token': API_TOKEN }
  ];

  for (const [index, headers] of authHeaders.entries()) {
    try {
      console.log(`\n🔑 Teste ${index + 1}: ${Object.keys(headers)[0]}: ${Object.values(headers)[0].substring(0, 20)}...`);
      
      const config = {
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      };

      let response;
      if (method.toLowerCase() === 'get') {
        response = await axios.get(url, config);
      } else if (method.toLowerCase() === 'post') {
        response = await axios.post(url, data || {}, config);
      }

      console.log(`✅ SUCESSO: ${response.status}`);
      
      // Se for um QR code, verificar se tem o código
      if (url.includes('connect')) {
        const qrCode = response.data?.qrcode || response.data?.qrCode || response.data?.base64;
        if (qrCode) {
          console.log(`🎉 QR CODE ENCONTRADO! Tamanho: ${qrCode.length} caracteres`);
          return { success: true, qrCode, headers };
        }
      }
      
      console.log(`📋 Dados:`, JSON.stringify(response.data, null, 2).substring(0, 300));
      return { success: true, data: response.data, headers };
      
    } catch (error) {
      console.log(`❌ ${error.response?.status || error.code}: ${error.message}`);
      
      if (error.response?.data) {
        console.log(`📋 Erro:`, JSON.stringify(error.response.data, null, 2).substring(0, 200));
      }
    }
  }
  
  console.log(`❌ Nenhum método de autenticação funcionou para ${url}`);
  return null;
}

/**
 * Lista de endpoints a serem testados.
 * Formato:
 * { method: 'get|post', url: 'url_completa', data?: {} (apenas para POST) }
 */
const endpoints = [
  // Endpoints básicos
  { method: 'get', url: `${API_URL}/` },
  
  // Endpoints da instância baseados na documentação
  { method: 'get', url: `${API_URL}/instance/fetchInstances` },
  { method: 'get', url: `${API_URL}/instance/connect/${INSTANCE}` },
  { method: 'get', url: `${API_URL}/instance/connectionState/${INSTANCE}` },
  
  // Variações de endpoints que podem funcionar
  { method: 'get', url: `${API_URL}/${INSTANCE}/connect` },
  { method: 'get', url: `${API_URL}/${INSTANCE}/qrcode` },
  { method: 'get', url: `${API_URL}/connect/${INSTANCE}` },
  { method: 'get', url: `${API_URL}/qrcode/${INSTANCE}` }
];

async function runTests() {
  console.log('🔧 TESTANDO DIFERENTES MÉTODOS DE AUTENTICAÇÃO');
  console.log('=' .repeat(60));
  
  for (const endpoint of endpoints) {
    console.log(`\n🌐 Testando: ${endpoint.method.toUpperCase()} ${endpoint.url}`);
    console.log('-' .repeat(50));
    
    const result = await testEndpoint(endpoint.method, endpoint.url, endpoint.data);
    
    if (result?.success && endpoint.url.includes('connect')) {
      console.log('\n🎉 ENDPOINT DE QR CODE FUNCIONANDO!');
      console.log(`🔑 Headers que funcionaram:`, result.headers);
      console.log(`📍 URL: ${endpoint.url}`);
      break;
    }
  }
  
  console.log('\n✅ Testes concluídos');
}

runTests();