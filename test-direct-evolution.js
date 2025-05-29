/**
 * Teste direto com base na configuração real da Evolution API
 */

import axios from 'axios';

const API_URL = 'https://api.primerastreadores.com';
const API_TOKEN = '0f9e7d76866fd738dbed11acfcef1403';
const INSTANCE = 'admin';

async function checkApiStatus(token) {
  try {
    console.log('1️⃣ Verificando status da API...');
    const response = await axios.get(`${API_URL}/`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`✅ API online: ${response.data.message} (v${response.data.version})`);
    return true;
  } catch (error) {
    console.log(`❌ API offline: ${error.message}`);
    return false;
  }
}

async function createInstance(token) {
  try {
    console.log('2️⃣ Tentando criar instância...');
    const response = await axios.post(`${API_URL}/instance/create`, {
      instanceName: INSTANCE,
      qrcode: true,
      webhook: null
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`✅ Instância criada: ${response.status}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 403 && error.response?.data?.response?.message?.[0]?.includes('already in use')) {
      console.log(`⚠️ Instância já existe (esperado)`);
      return { exists: true };
    }
    console.log(`❌ Erro ao criar: ${error.response?.status} - ${error.response?.data?.response?.message || error.message}`);
    return null;
  }
}

async function getQrCode(token) {
  try {
    console.log('3️⃣ Solicitando QR Code...');
    
    // Tentar vários endpoints baseados na documentação Evolution API
    const endpoints = [
      `/instance/connect/${INSTANCE}`,
      `/instance/${INSTANCE}/connect`,
      `/instance/${INSTANCE}/qrcode`,
      `/${INSTANCE}/connect`
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`   Testando: GET ${API_URL}${endpoint}`);
        const response = await axios.get(`${API_URL}${endpoint}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          timeout: 15000
        });
        
        console.log(`   Status: ${response.status}`);
        
        // Verificar diferentes formatos de QR code
        const qrCode = response.data?.qrcode || 
                      response.data?.qrCode || 
                      response.data?.base64 || 
                      response.data?.code ||
                      response.data?.instance?.qrcode ||
                      response.data?.data?.qrcode;
        
        if (qrCode) {
          console.log(`✅ QR Code obtido com sucesso via ${endpoint}!`);
          console.log(`📱 QR Code: ${qrCode.substring(0, 50)}...`);
          return { success: true, qrCode, endpoint };
        }
        
        // Verificar se já está conectado
        if (response.data?.state === 'open' || 
            response.data?.connected === true ||
            response.data?.instance?.state === 'open') {
          console.log(`✅ Instância já conectada via ${endpoint}!`);
          return { success: true, connected: true, endpoint };
        }
        
        console.log(`   Dados: ${JSON.stringify(response.data, null, 2).substring(0, 200)}...`);
        
      } catch (endpointError) {
        console.log(`   ❌ ${endpointError.response?.status || endpointError.code}: ${endpointError.message}`);
      }
    }
    
    console.log('❌ Nenhum endpoint de QR code funcionou');
    return null;
    
  } catch (error) {
    console.log(`❌ Erro geral: ${error.message}`);
    return null;
  }
}

async function testAllTokens() {
  console.log('🔧 TESTANDO CONFIGURAÇÃO COMPLETA DA EVOLUTION API');
  console.log('=' .repeat(60));
  
  const tokens = [API_TOKEN];
  
  for (const token of tokens) {
    console.log(`\n🔑 Testando token: ${token.substring(0, 10)}...`);
    
    // 1. Verificar API
    const apiOnline = await checkApiStatus(token);
    if (!apiOnline) continue;
    
    // 2. Criar/verificar instância
    const instanceResult = await createInstance(token);
    if (!instanceResult) continue;
    
    // 3. Obter QR code
    const qrResult = await getQrCode(token);
    if (qrResult?.success) {
      console.log('\n🎉 SUCESSO! Configuração funcionando.');
      return qrResult;
    }
  }
  
  console.log('\n❌ Nenhuma configuração funcionou completamente.');
  return null;
}

testAllTokens();