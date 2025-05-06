/**
 * Script para testar acesso direto à Evolution API
 * Este script testa diferentes rotas e verbos para encontrar a combinação certa
 */

import axios from 'axios';

// Configurações - ALTERE ESTAS VARIÁVEIS
const baseUrl = 'https://api.primerastreadores.com';
const instance = 'admin';
const token = '4db623449606bcf2814521b73657dbc0'; // Token que sabemos que funciona

// Funções auxiliares
async function testEndpoint(method, url, data = null) {
  console.log(`\n${method.toUpperCase()} ${url}`);
  console.log('-'.repeat(40));
  
  try {
    const config = {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    let response;
    if (method.toLowerCase() === 'get') {
      response = await axios.get(url, config);
    } else if (method.toLowerCase() === 'post') {
      response = await axios.post(url, data, config);
    }
    
    if (response.status === 200 || response.status === 201) {
      console.log(`✅ SUCESSO! Status: ${response.status}`);
      
      // Verifica se a resposta é um HTML
      const contentType = response.headers['content-type'] || '';
      const isHtml = contentType.includes('text/html') || 
                    (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>'));
      
      if (isHtml) {
        console.log('❌ AVISO: Resposta parece ser HTML');
        console.log(response.data.substring(0, 100) + '...');
        return { success: false, isHtml: true };
      }
      
      // Verificar se a resposta contém um QR code
      const hasQrCode = response.data && (
        response.data.qrcode || 
        response.data.qrCode || 
        response.data.base64 || 
        response.data.code ||
        response.data.data?.qrcode ||
        response.data.data?.qrCode
      );
      
      if (hasQrCode) {
        console.log('✅ QR CODE ENCONTRADO!');
        // Mostrar apenas os primeiros caracteres do QR code
        const qrData = response.data.qrcode || 
                      response.data.qrCode || 
                      response.data.base64 || 
                      response.data.code ||
                      response.data.data?.qrcode ||
                      response.data.data?.qrCode;
        console.log(`QR Code (primeiros 50 chars): ${qrData.substring(0, 50)}...`);
        return { success: true, hasQrCode: true, qrData };
      }
      
      console.log('Resposta:', JSON.stringify(response.data).substring(0, 300) + '...');
      return { success: true, data: response.data };
    } else {
      console.log(`❌ Falha! Status: ${response.status}`);
      console.log('Resposta:', response.data);
      return { success: false };
    }
  } catch (error) {
    console.log(`❌ ERRO: ${error.message}`);
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log('Dados:', error.response.data);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Lista de endpoints a serem testados.
 * Formato:
 * { method: 'get|post', url: 'url_completa', data?: {} (apenas para POST) }
 */
const endpointsToTest = [
  // Básico - Verificar acesso à API
  { method: 'get', url: `${baseUrl}` },
  { method: 'get', url: `${baseUrl}/manager` },
  
  // Lista de instâncias - apenas para diagnóstico
  { method: 'get', url: `${baseUrl}/instances` },
  { method: 'get', url: `${baseUrl}/instance/fetchInstances` },
  
  // Criação de instâncias - IMPORTANTE
  { method: 'post', url: `${baseUrl}/instance/create`, data: {
    instanceName: instance,
    token: token,
    integration: "WHATSAPP-BAILEYS", 
    qrcode: true,
    webhook_base64: true
  }},
  { method: 'post', url: `${baseUrl}/instance/create/${instance}`, data: {
    token: token,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true
  }},
  
  // QR Code - formatos diferentes de endpoints
  { method: 'post', url: `${baseUrl}/instance/qrcode`, data: { instanceName: instance } },
  { method: 'get', url: `${baseUrl}/instance/qrcode/${instance}` },
  { method: 'get', url: `${baseUrl}/instance/connect/${instance}` },
  { method: 'get', url: `${baseUrl}/manager/instance/qrcode/${instance}` },
  
  // Verificação de estado da conexão
  { method: 'get', url: `${baseUrl}/instance/connectionState/${instance}` },
  { method: 'get', url: `${baseUrl}/manager/instance/connectionState/${instance}` },
  
  // Outras opções para teste
  { method: 'get', url: `${baseUrl}/instance/info/${instance}` },
  { method: 'get', url: `${baseUrl}/instance/status/${instance}` }
];

// Função principal
async function runTests() {
  console.log('TESTE DE ACESSO À EVOLUTION API');
  console.log('==============================');
  console.log(`URL Base: ${baseUrl}`);
  console.log(`Instância: ${instance}`);
  console.log(`Token: ${token.substring(0, 5)}...${token.substring(token.length - 5)}`);
  console.log('\nIniciando testes...\n');
  
  // Primeiro vamos verificar a API básica
  const apiResult = await testEndpoint('get', baseUrl);
  if (!apiResult.success) {
    console.log('\n❌ ERRO CRÍTICO: Não foi possível acessar a API Evolution. Cancelando testes.');
    return;
  }
  
  console.log('\n✅ API acessível. Continuando com os testes de endpoints específicos...');
  
  // Agora vamos testar cada endpoint
  let successfulEndpoints = [];
  
  for (const endpoint of endpointsToTest) {
    console.log(`\n${'-'.repeat(60)}`);
    const result = await testEndpoint(endpoint.method, endpoint.url, endpoint.data);
    
    if (result.success) {
      const endpointInfo = {
        method: endpoint.method,
        url: endpoint.url,
        hasQrCode: result.hasQrCode || false
      };
      successfulEndpoints.push(endpointInfo);
      
      // Se encontrou um QR code, destacar isso
      if (result.hasQrCode) {
        console.log('\n🔵🔵🔵 ATENÇÃO! QR CODE ENCONTRADO NESTE ENDPOINT 🔵🔵🔵');
        console.log(`Método: ${endpoint.method.toUpperCase()}`);
        console.log(`URL: ${endpoint.url}`);
        if (endpoint.data) {
          console.log(`Dados: ${JSON.stringify(endpoint.data)}`);
        }
        console.log('🔵🔵🔵 GUARDE ESTA INFORMAÇÃO PARA CONFIGURAÇÃO 🔵🔵🔵\n');
      }
    }
  }
  
  // Resumo
  console.log('\n' + '='.repeat(60));
  console.log('RESUMO DOS TESTES');
  console.log('='.repeat(60));
  console.log(`Total de endpoints testados: ${endpointsToTest.length}`);
  console.log(`Endpoints com sucesso: ${successfulEndpoints.length}`);
  
  if (successfulEndpoints.length > 0) {
    console.log('\nEndpoints que funcionaram:');
    successfulEndpoints.forEach((endpoint, index) => {
      console.log(`${index + 1}. ${endpoint.method.toUpperCase()} ${endpoint.url} ${endpoint.hasQrCode ? '✅ QR CODE!' : ''}`);
    });
  } else {
    console.log('\n❌ Nenhum endpoint funcionou corretamente.');
  }
}

// Executa os testes
runTests().catch(error => {
  console.error('Erro ao executar testes:', error);
});