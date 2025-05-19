/**
 * Script para testar o endpoint findContacts da Evolution API
 * Este é o endpoint que retorna os contatos do WhatsApp
 */

import axios from 'axios';

const apiUrl = 'https://api.primerastreadores.com';
const instanceName = 'admin';
const apiToken = process.env.EVOLUTION_API_TOKEN || '4db623449606bcf2814521b73657dbc0';

// Headers de autenticação - tentando todos os formatos possíveis
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${apiToken}`,
  'apikey': apiToken,
  'AUTHENTICATION_API_KEY': apiToken
};

async function testFindContacts() {
  console.log('Testando endpoint /chat/findContacts...');
  console.log('-------------------------------------');
  
  try {
    // Tentativa 1: Usando o formato da documentação
    const endpoint = `${apiUrl}/chat/findContacts/${instanceName}`;
    console.log(`Tentando POST para: ${endpoint}`);
    
    const response = await axios.post(endpoint, {}, {
      headers: headers
    });
    
    console.log('Resposta recebida:');
    console.log('Status:', response.status);
    console.log('Estrutura de dados:', JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
    
    // Tentando interpretar o formato da resposta
    if (Array.isArray(response.data)) {
      console.log(`Array com ${response.data.length} contatos`);
      if (response.data.length > 0) {
        console.log('Exemplo de contato:', JSON.stringify(response.data[0], null, 2));
      }
    } else if (response.data && response.data.contacts) {
      console.log(`Array contacts com ${response.data.contacts.length} contatos`);
      if (response.data.contacts.length > 0) {
        console.log('Exemplo de contato:', JSON.stringify(response.data.contacts[0], null, 2));
      }
    } else {
      console.log('Formato desconhecido, mostrando resposta completa:');
      console.log(JSON.stringify(response.data, null, 2));
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao chamar o endpoint findContacts:');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      console.error('Sem resposta recebida');
      console.error(error.request);
    } else {
      console.error('Erro na configuração da requisição:', error.message);
    }
    
    return false;
  }
}

// Tenta uma abordagem alternativa se a primeira falhar
async function testOtherEndpoints() {
  console.log('\nTestando endpoints alternativos...');
  console.log('----------------------------------');
  
  const endpoints = [
    '/chat/contacts',
    '/manager/contacts',
    '/manager/findContacts',
    '/instance/contacts',
    '/instance/getAllContacts'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const url = `${apiUrl}${endpoint}/${instanceName}`;
      console.log(`\nTentando POST para: ${url}`);
      
      const response = await axios.post(url, {}, {
        headers: headers,
        timeout: 5000
      });
      
      console.log('Sucesso! Status:', response.status);
      console.log('Dados:', typeof response.data);
      
      // Apenas mostra um resumo para não sobrecarregar o console
      if (Array.isArray(response.data)) {
        console.log(`Encontrados ${response.data.length} contatos`);
      } else if (typeof response.data === 'object') {
        console.log('Estrutura da resposta:', Object.keys(response.data));
      }
      
      return { success: true, endpoint, data: response.data };
    } catch (error) {
      console.log(`Erro ao tentar ${endpoint}: ${error.message}`);
    }
  }
  
  return { success: false };
}

// Função principal que executa os testes
async function run() {
  const success = await testFindContacts();
  
  if (!success) {
    console.log('\nO endpoint principal falhou, tentando alternativas...');
    const altResult = await testOtherEndpoints();
    
    if (altResult.success) {
      console.log(`\n✅ Endpoint alternativo funcionou: ${altResult.endpoint}`);
    } else {
      console.log('\n❌ Nenhum endpoint funcionou. Verifique a configuração da API.');
    }
  } else {
    console.log('\n✅ Endpoint principal funcionou!');
  }
}

// Executa os testes
run().catch(console.error);