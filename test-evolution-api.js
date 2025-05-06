// Script para testar a conexão com a Evolution API
// Este script ajuda a verificar se a conexão está funcionando corretamente

// Importações necessárias
import axios from 'axios';

// Configurações
const API_URL = 'https://api.primerastreadores.com';
const API_TOKEN = '4db623449606bcf2814521b73657dbc0';
const INSTANCE_NAME = 'admin'; // Altere para o nome da instância que deseja testar

// Funções auxiliares
function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_TOKEN}`,
    'apikey': API_TOKEN,
    'AUTHENTICATION_API_KEY': API_TOKEN
  };
}

// Testar a conexão inicial com a API
async function testApiConnection() {
  try {
    console.log('Testando conexão com a API Evolution...');
    const response = await axios.get(API_URL, {
      headers: getHeaders()
    });
    
    console.log('✅ Conexão bem-sucedida!');
    console.log('Detalhes da API:');
    console.log(`- Versão: ${response.data.version}`);
    console.log(`- Cliente: ${response.data.clientName}`);
    console.log(`- Manager URL: ${response.data.manager}`);
    console.log(`- Documentação: ${response.data.documentation}`);
    
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao conectar com a API:');
    console.error(error.message);
    if (error.response) {
      console.error('Detalhes do erro:');
      console.error(error.response.data);
    }
    return null;
  }
}

// Criar uma instância
async function createInstance() {
  try {
    console.log(`\nCriando instância '${INSTANCE_NAME}'...`);
    
    const createInstanceBody = {
      instanceName: INSTANCE_NAME,
      token: API_TOKEN,
      webhook: null,
      webhookByEvents: false,
      integration: "WHATSAPP-BAILEYS", // Parâmetro crítico para a versão 2.x
      language: "pt-BR",
      qrcode: true,
      qrcodeImage: true,
      reject_call: false,
      events_message: false,
      ignore_group: false,
      ignore_broadcast: false,
      save_message: true,
      webhook_base64: true
    };
    
    const response = await axios.post(
      `${API_URL}/instance/create`, 
      createInstanceBody, 
      { headers: getHeaders() }
    );
    
    console.log('✅ Instância criada ou atualizada com sucesso!');
    console.log('Detalhes da instância:');
    console.log(`- Nome: ${response.data.instance.instanceName}`);
    console.log(`- ID: ${response.data.instance.instanceId}`);
    console.log(`- Status: ${response.data.instance.status}`);
    console.log(`- Integração: ${response.data.instance.integration}`);
    
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao criar instância:');
    console.error(error.message);
    if (error.response) {
      console.error('Detalhes do erro:');
      console.error(error.response.data);
    }
    return null;
  }
}

// Obter QR Code para conexão
async function getQrCode() {
  try {
    console.log(`\nObtendo QR Code para a instância '${INSTANCE_NAME}'...`);
    
    // Tentar diretamente o endpoint conhecido que funciona
    const response = await axios.get(
      `${API_URL}/instance/connect/${INSTANCE_NAME}`, 
      { headers: getHeaders() }
    );
    
    if (response.data && response.data.qrcode) {
      console.log('✅ QR Code obtido com sucesso!');
      console.log('QR Code base64 (primeiros 100 caracteres):');
      console.log(response.data.qrcode.substring(0, 100) + '...');
      
      // Salvar o QR Code para um arquivo se estiver em ambiente node
      // Modificado para usar a sintaxe de módulo ES
      if (typeof window === 'undefined') {
        try {
          // Usando dynamic import que funciona em ES modules
          const fs_module = await import('fs');
          fs_module.default.writeFileSync('qrcode.txt', response.data.qrcode);
          console.log('QR Code salvo no arquivo qrcode.txt');
        } catch (fsError) {
          console.error('Erro ao salvar QR code no arquivo:', fsError.message);
        }
      }
      
      return response.data;
    } else {
      console.log('⚠️ Resposta recebida, mas QR Code não encontrado');
      console.log('Resposta completa:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Erro ao obter QR Code:');
    console.error(error.message);
    if (error.response) {
      console.error('Detalhes do erro:');
      console.error(error.response.data);
    }
    
    return null;
  }
}

// Verificar o estado da conexão
async function checkConnectionStatus() {
  try {
    console.log(`\nVerificando status da conexão para a instância '${INSTANCE_NAME}'...`);
    
    // Buscar informações da API primeiro para obter o manager URL
    const apiInfo = await testApiConnection();
    if (!apiInfo) {
      console.error('❌ Não foi possível obter informações da API');
      return null;
    }
    
    const managerUrl = apiInfo.manager;
    const secureManagerUrl = managerUrl.replace(/^http:/, 'https:');
    
    // Tentar os endpoints comuns para status
    const endpoints = [
      `${secureManagerUrl}/instance/connectionState/${INSTANCE_NAME}`,
      `${API_URL}/instance/connectionState/${INSTANCE_NAME}`,
      `${API_URL}/instance/status/${INSTANCE_NAME}`
    ];
    
    let connected = false;
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Testando endpoint: ${endpoint}`);
        const response = await axios.get(endpoint, { headers: getHeaders() });
        
        console.log(`Resposta de ${endpoint}:`, response.data);
        
        if (response.data && (response.data.state === 'open' || response.data.connected === true)) {
          connected = true;
          console.log('✅ Instância conectada!');
          return response.data;
        }
      } catch (endpointError) {
        console.log(`Erro ao acessar ${endpoint}:`, endpointError.message);
      }
    }
    
    console.log('⚠️ Instância não está conectada');
    return { connected: false };
  } catch (error) {
    console.error('❌ Erro ao verificar status da conexão:');
    console.error(error.message);
    if (error.response) {
      console.error('Detalhes do erro:');
      console.error(error.response.data);
    }
    return null;
  }
}

// Listar instâncias existentes
async function listInstances() {
  try {
    console.log('\nListando instâncias existentes...');
    
    const response = await axios.get(
      `${API_URL}/instance/fetchInstances`, 
      { headers: getHeaders() }
    );
    
    if (Array.isArray(response.data)) {
      console.log(`✅ ${response.data.length} instâncias encontradas:`);
      
      response.data.forEach((instance, index) => {
        console.log(`\nInstância #${index + 1}:`);
        console.log(`- Nome: ${instance.name}`);
        console.log(`- Status: ${instance.connectionStatus}`);
        console.log(`- Telefone: ${instance.number || 'N/A'}`);
        console.log(`- Integração: ${instance.integration}`);
        console.log(`- Criada em: ${new Date(instance.createdAt).toLocaleString()}`);
        console.log(`- Atualizada em: ${new Date(instance.updatedAt).toLocaleString()}`);
      });
      
      return response.data;
    } else {
      console.log('⚠️ Resposta recebida, mas não é uma lista de instâncias');
      console.log('Resposta completa:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Erro ao listar instâncias:');
    console.error(error.message);
    if (error.response) {
      console.error('Detalhes do erro:');
      console.error(error.response.data);
    }
    return null;
  }
}

// Função principal para executar vários testes
async function runTests() {
  try {
    console.log('=== TESTANDO EVOLUTION API ===');
    console.log(`URL: ${API_URL}`);
    console.log(`Token: ${API_TOKEN.substring(0, 5)}...${API_TOKEN.substring(API_TOKEN.length - 5)}`);
    console.log(`Instância: ${INSTANCE_NAME}`);
    console.log('=============================\n');
    
    // Etapa 1: Testar conexão com a API
    const apiInfo = await testApiConnection();
    if (!apiInfo) {
      console.error('❌ Teste falhou: Não foi possível conectar com a API. Abortando testes.');
      return;
    }
    
    // Etapa 2: Listar instâncias existentes
    await listInstances();
    
    // Etapa 3: Criar instância
    const instanceResult = await createInstance();
    if (!instanceResult) {
      console.error('❌ Teste falhou: Não foi possível criar a instância. Continuando mesmo assim...');
    }
    
    // Etapa 4: Verificar status da conexão
    const statusResult = await checkConnectionStatus();
    
    // Etapa 5: Se não estiver conectado, obter QR Code
    if (!statusResult || !statusResult.connected) {
      console.log('\nInstância não está conectada. Obtendo QR Code para conexão...');
      await getQrCode();
    } else {
      console.log('\nInstância já está conectada! Não é necessário obter QR Code.');
    }
    
    console.log('\n=== TESTES CONCLUÍDOS ===');
  } catch (error) {
    console.error('Erro geral ao executar testes:');
    console.error(error);
  }
}

// Executar os testes
runTests();