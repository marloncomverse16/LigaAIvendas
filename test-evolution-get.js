/**
 * Script para testar especificamente o acesso ao QR Code da Evolution API
 * usando APENAS o método GET conforme solicitado
 */

import axios from 'axios';

// Configurações
const baseUrl = 'https://api.primerastreadores.com';
const token = process.env.EVOLUTION_API_TOKEN || '4db623449606bcf2814521b73657dbc0';
const instance = 'admin';  // teste com a instância admin

// Headers com token no formato 'apikey'
function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': token
  };
}

// Testa apenas o modo GET
async function testGetOnlyMode() {
  console.log(`\n===== TESTE MODO GET APENAS =====`);
  console.log(`URL Base: ${baseUrl}`);
  console.log(`Token: ${token.substring(0, 5)}...${token.substring(token.length - 5)}`);
  console.log(`Instância: ${instance}`);

  try {
    // Primeiro verificar o status da API
    console.log("\nVerificando API status...");
    const apiResponse = await axios.get(baseUrl, { headers: getHeaders() });
    console.log("API Status:", apiResponse.status);
    console.log("API Versão:", apiResponse.data.version);
    console.log("Manager URL:", apiResponse.data.manager);

    // Lista de endpoints a testar via GET
    const endpoints = [
      `/instance/qrcode/${instance}`,
      `/instance/connect/${instance}`,
      `/instance/fetchInstances`,
      `/instance/connectionState/${instance}`,
      `/manager/instance/qrcode/${instance}`,
      `/api/session/qrcode/${instance}`,
      `/client/qrcode/${instance}`,
      `/qrcode/${instance}`
    ];

    // Testar cada endpoint via GET
    for (const endpoint of endpoints) {
      console.log(`\n\nTentando endpoint: ${baseUrl}${endpoint} (via GET)`);
      
      try {
        const response = await axios.get(`${baseUrl}${endpoint}`, {
          headers: getHeaders(),
          timeout: 5000
        });
        
        console.log(`✓ Status: ${response.status}`);
        
        // Verifica se encontrou HTML na resposta
        const responseStr = typeof response.data === 'string' 
          ? response.data 
          : JSON.stringify(response.data);
          
        if (responseStr.includes('<!DOCTYPE html>') || 
            responseStr.includes('<html') || 
            responseStr.includes('<body')) {
          console.log(`✗ Contém HTML - Resposta inválida`);
          continue;
        }
        
        // Verifica QR code em diferentes formatos
        const qrCode = response.data?.qrcode || 
                      response.data?.qrCode || 
                      response.data?.base64 || 
                      response.data?.code;
                      
        if (qrCode) {
          console.log(`✓ QR CODE ENCONTRADO: ${qrCode.substring(0, 30)}...`);
        } else if (typeof response.data === 'string' && response.data.startsWith('data:image')) {
          console.log(`✓ QR CODE ENCONTRADO (string base64): ${response.data.substring(0, 30)}...`);
        } else {
          console.log(`Resposta sem QR code reconhecível`);
          console.log("Tipo de resposta:", typeof response.data);
          console.log("Campos disponíveis:", Object.keys(response.data || {}).join(', '));
        }
        
      } catch (error) {
        console.log(`✗ Erro: ${error.message}`);
        if (error.response) {
          console.log(`  Status: ${error.response.status}`);
          console.log(`  Dados: ${JSON.stringify(error.response.data || {}).substring(0, 100)}`);
        }
      }
    }
    
  } catch (error) {
    console.error("Erro geral:", error.message);
  }
}

// Execute o teste
testGetOnlyMode();