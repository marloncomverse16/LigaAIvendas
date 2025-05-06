// Script para testar diretamente a conexão com a Evolution API
// Usando abordagem simples e direta sem abstrações

import axios from 'axios';

// Constantes e configurações
const BASE_URL = 'https://api.primerastreadores.com';
const INSTANCE_NAME = 'admin';

// Lista de tokens para testar
const TOKENS = [
  '4db623449606bcf2814521b73657dbc0', // Token que sabemos que funciona para criação
  process.env.EVOLUTION_API_TOKEN,    // Token do ambiente
  'LigAi01',                          // Token específico da aplicação
];

// Função para verificar status da API
async function checkApiStatus(token) {
  try {
    console.log(`\n === TESTANDO TOKEN: ${token.substring(0, 3)}...${token.substring(token.length - 3)} ===`);
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': token,
      'AUTHENTICATION_API_KEY': token
    };
    
    console.log(`Verificando status da API com token: ${token.substring(0, 3)}...`);
    const response = await axios.get(BASE_URL, { headers });
    
    console.log(`Status da API: ${response.status}`);
    console.log(`Resposta: ${JSON.stringify(response.data)}`);
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error(`Erro ao verificar API com token ${token.substring(0, 3)}...: ${error.message}`);
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Resposta: ${JSON.stringify(error.response.data || {})}`);
    }
    
    return { success: false, error: error.message };
  }
}

// Função para criar instância
async function createInstance(token) {
  try {
    console.log(`\nCriando instância ${INSTANCE_NAME} com token: ${token.substring(0, 3)}...`);
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': token,
      'AUTHENTICATION_API_KEY': token
    };
    
    const data = {
      instanceName: INSTANCE_NAME,
      token: token,
      webhook: null,
      webhookByEvents: false,
      integration: "WHATSAPP-BAILEYS",
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
    
    // Tentar primeiro endpoint
    try {
      const response = await axios.post(`${BASE_URL}/instance/create`, data, { headers });
      console.log(`Instância criada! Status: ${response.status}`);
      console.log(`Resposta: ${JSON.stringify(response.data)}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.log(`Primeiro endpoint falhou: ${error.message}`);
      
      // Tentar segundo endpoint
      try {
        const response = await axios.post(`${BASE_URL}/instance/create/${INSTANCE_NAME}`, data, { headers });
        console.log(`Instância criada (endpoint 2)! Status: ${response.status}`);
        console.log(`Resposta: ${JSON.stringify(response.data)}`);
        return { success: true, data: response.data };
      } catch (error2) {
        console.log(`Segundo endpoint falhou: ${error2.message}`);
        
        // Tentar verificar se a instância já existe
        try {
          const response = await axios.get(`${BASE_URL}/instance/exists/${INSTANCE_NAME}`, { headers });
          console.log(`Verificação de existência: ${JSON.stringify(response.data)}`);
          return { success: false, exists: response.data?.exists, error: 'Não foi possível criar, mas pode já existir' };
        } catch (error3) {
          console.log(`Verificação de existência falhou: ${error3.message}`);
        }
        
        return { success: false, error: error2.message };
      }
    }
  } catch (error) {
    console.error(`Erro geral ao criar instância: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Função para obter QR code
async function getQrCode(token) {
  try {
    console.log(`\nObtendo QR code para ${INSTANCE_NAME} com token: ${token.substring(0, 3)}...`);
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': token,
      'AUTHENTICATION_API_KEY': token
    };
    
    // Verificar status da instância primeiro
    try {
      console.log(`Verificando status da instância ${INSTANCE_NAME}...`);
      const statusUrl = `${BASE_URL}/instance/connectionState/${INSTANCE_NAME}`;
      const statusResponse = await axios.get(statusUrl, { headers });
      console.log(`Status da instância: ${JSON.stringify(statusResponse.data)}`);
      
      // Se já estiver conectado, não precisa de QR code
      if (statusResponse.data?.state === 'open' || 
          statusResponse.data?.state === 'connected') {
        console.log(`✅ Instância já conectada!`);
        return { 
          success: true, 
          alreadyConnected: true,
          connectionInfo: statusResponse.data 
        };
      }
    } catch (error) {
      console.log(`Não foi possível verificar status: ${error.message}`);
      // Continuar mesmo com erro, tentando obter o QR code
    }
    
    // Tentar POST para sessão primeiro
    try {
      console.log(`Iniciando sessão para ${INSTANCE_NAME}...`);
      const sessionUrl = `${BASE_URL}/instance/connect/${INSTANCE_NAME}`;
      const sessionResponse = await axios.post(sessionUrl, {}, { headers });
      console.log(`Resposta da sessão: ${JSON.stringify(sessionResponse.data)}`);
    } catch (error) {
      console.log(`Erro ao iniciar sessão: ${error.message}`);
      // Continuar mesmo com erro, tentando obter o QR code
    }
    
    // Lista de endpoints para tentar
    const endpoints = [
      `${BASE_URL}/instance/qrcode/${INSTANCE_NAME}`,
      `${BASE_URL}/qrcode/${INSTANCE_NAME}`,
      `${BASE_URL}/instance/connect/${INSTANCE_NAME}`, // Novo endpoint para conectar e obter QR
      `${BASE_URL}/manager/instance/qrcode/${INSTANCE_NAME}`,
      `${BASE_URL}/manager/qrcode/${INSTANCE_NAME}`
    ];
    
    // Para cada endpoint, tentar POST primeiro, depois GET
    for (const endpoint of endpoints) {
      try {
        // Tentar POST primeiro
        console.log(`Tentando POST para: ${endpoint}`);
        const postResponse = await axios.post(endpoint, {}, { headers });
        
        if (postResponse.status === 200 || postResponse.status === 201) {
          console.log(`QR code obtido via POST em ${endpoint}!`);
          
          if (typeof postResponse.data === 'object') {
            console.log(`Detalhes da resposta POST: ${JSON.stringify(postResponse.data)}`);
          }
          
          // Verificar se a resposta tem QR code
          if (postResponse.data?.qrcode || postResponse.data?.qrCode || 
              postResponse.data?.base64 || postResponse.data?.code) {
            const qrCode = postResponse.data?.qrcode || postResponse.data?.qrCode || 
                          postResponse.data?.base64 || postResponse.data?.code;
            console.log(`QR code encontrado via POST!`);
            return { success: true, qrCode };
          }
        }
      } catch (error) {
        console.log(`POST para ${endpoint} falhou: ${error.message}`);
      }
      
      // Tentar GET
      try {
        console.log(`Tentando GET para: ${endpoint}`);
        const response = await axios.get(endpoint, { headers });
        
        if (response.status === 200 || response.status === 201) {
          console.log(`Resposta obtida via GET em ${endpoint}!`);
          
          // Examinar o tipo de resposta
          const responseType = typeof response.data;
          console.log(`Tipo de resposta: ${responseType}`);
          
          // Se for objeto, mostrar detalhes
          if (responseType === 'object') {
            console.log(`Detalhes da resposta: ${JSON.stringify(response.data)}`);
          }
          
          // Se for HTML, reportar erro
          if (responseType === 'string' && 
             (response.data.includes('<!DOCTYPE html>') || 
              response.data.includes('<html>'))) {
            console.log(`ERRO: Recebido HTML em vez de QR code`);
            // Verificar se há dicas no HTML sobre o problema
            if (response.data.includes('Forbidden') || response.data.includes('403')) {
              console.log(`HTML indica erro 403 - Acesso Proibido`);
            } else if (response.data.includes('Unauthorized') || response.data.includes('401')) {
              console.log(`HTML indica erro 401 - Não Autorizado`);
            } else if (response.data.includes('Not Found') || response.data.includes('404')) {
              console.log(`HTML indica erro 404 - Não Encontrado`);
            }
            // Continuar tentando outros endpoints
            continue;
          }
          
          // Tentar identificar se há um QR code na resposta
          const qrCode = 
            response.data?.qrcode || 
            response.data?.qrCode || 
            response.data?.base64 || 
            response.data?.code ||
            (responseType === 'string' ? response.data : null);
          
          if (qrCode) {
            // Se for string e começar com data: ou http, é provavelmente um QR code válido
            if (typeof qrCode === 'string' && 
               (qrCode.startsWith('data:') || qrCode.startsWith('http'))) {
              console.log(`QR code válido encontrado!`);
              return { success: true, qrCode };
            }
            
            // QR como base64
            if (typeof qrCode === 'string' && qrCode.match(/^[A-Za-z0-9+/=]+$/)) {
              console.log(`QR code como base64 encontrado!`);
              return { success: true, qrCode };
            }
            
            console.log(`QR code em formato desconhecido: ${typeof qrCode}`);
            if (typeof qrCode === 'string') {
              console.log(`Começo do QR: ${qrCode.substring(0, 30)}...`);
            }
          } else {
            console.log(`Nenhum QR code encontrado na resposta`);
          }
        }
      } catch (error) {
        console.log(`GET para ${endpoint} falhou: ${error.message}`);
      }
    }
    
    // Ainda não encontramos QR code, tentar verificar logs da instância
    try {
      console.log(`\nVerificando logs da instância ${INSTANCE_NAME}...`);
      const logsUrl = `${BASE_URL}/instance/logs/${INSTANCE_NAME}`;
      const logsResponse = await axios.get(logsUrl, { headers });
      if (logsResponse.data && Array.isArray(logsResponse.data)) {
        const lastLogs = logsResponse.data.slice(-5);
        console.log(`Últimos logs: ${JSON.stringify(lastLogs)}`);
      }
    } catch (error) {
      console.log(`Não foi possível obter logs: ${error.message}`);
    }
    
    return { success: false, error: 'Não foi possível obter QR code em nenhum endpoint' };
  } catch (error) {
    console.error(`Erro geral ao obter QR code: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Função principal para testar todos os tokens
async function testAllTokens() {
  for (const token of TOKENS.filter(Boolean)) {
    // Verificar status da API
    const statusResult = await checkApiStatus(token);
    
    if (statusResult.success) {
      // Tentar criar a instância
      const createResult = await createInstance(token);
      
      // Tentar obter QR code independentemente do resultado da criação
      const qrResult = await getQrCode(token);
      
      if (qrResult.success) {
        console.log(`\n✅ SUCESSO COMPLETO com token ${token.substring(0, 3)}...`);
        console.log(`QR Code obtido com sucesso!`);
        return;
      }
    }
    
    console.log(`\n❌ FALHA com token ${token.substring(0, 3)}...`);
  }
  
  console.log(`\n⚠️ AVISO: Nenhum token funcionou completamente.`);
}

// Executar testes
testAllTokens().catch(error => {
  console.error('Erro geral no teste:', error);
});