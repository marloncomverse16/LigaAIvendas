/**
 * Teste direto do endpoint que funcionava anteriormente
 */

import axios from 'axios';

const API_URL = 'https://api.primerastreadores.com';
const API_TOKEN = '0f9e7d76866fd738dbed11acfcef1403';
const INSTANCE = 'admin';

async function testWorkingEndpoint() {
  const endpoint = `${API_URL}/instance/connect/${INSTANCE}`;
  
  console.log('🔍 Testando endpoint que funcionava anteriormente:');
  console.log(`   ${endpoint}`);
  console.log(`   Token: ${API_TOKEN.substring(0, 10)}...`);
  
  try {
    const response = await axios.get(endpoint, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log(`✅ Status: ${response.status}`);
    
    if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
      console.log('❌ Retornou HTML - problema de autenticação ou endpoint incorreto');
      console.log('Conteúdo:', response.data.substring(0, 200) + '...');
    } else {
      console.log('✅ Retornou dados JSON:');
      console.log(JSON.stringify(response.data, null, 2).substring(0, 500) + '...');
    }
    
  } catch (error) {
    console.log(`❌ Erro: ${error.response?.status || error.code} - ${error.message}`);
    
    if (error.response?.data) {
      console.log('Dados do erro:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testWorkingEndpoint();