// test-qr-code-api.js
// Script simples para testar a obtenção de QR code para WhatsApp

import axios from 'axios';

// Configurações - usar valores idênticos aos do servidor
const baseUrl = 'https://api.primerastreadores.com'; 
const instance = 'admin';  // nome da instância
const token = process.env.EVOLUTION_API_TOKEN || '4db623449606bcf2814521b73657dbc0';

// Headers da requisição
const headers = {
  'Content-Type': 'application/json',
  'apikey': token
};

// Função principal
async function getQrCode() {
  console.log(`Tentando obter QR code para instância ${instance} no servidor ${baseUrl}`);
  console.log(`Usando token: ${token.substring(0, 5)}...${token.substring(token.length - 5)}`);
  
  // Caminho específico que sabemos que funciona
  const url = `${baseUrl}/instance/connect/${instance}`;
  
  try {
    console.log(`Fazendo requisição GET para: ${url}`);
    const response = await axios.get(url, { headers });
    
    console.log(`Resposta obtida com status: ${response.status}`);
    
    // Verificar se a resposta contém HTML
    if (typeof response.data === 'string' && 
        (response.data.includes('<!DOCTYPE html>') || 
         response.data.includes('<html'))) {
      console.log('ERRO: A resposta contém HTML, não um QR code válido');
      return;
    }
    
    // Verificar o conteúdo da resposta
    if (typeof response.data === 'string') {
      console.log('QR Code encontrado como string');
      console.log(`Primeiros 100 caracteres: ${response.data.substring(0, 100)}...`);
    } else {
      console.log('Resposta como objeto JSON:');
      console.log(JSON.stringify(response.data, null, 2));
      
      // Verificar QR code em vários formatos possíveis
      const qrCode = response.data?.qrcode || 
                    response.data?.qrCode || 
                    response.data?.base64 || 
                    response.data?.code;
      
      if (qrCode) {
        console.log(`QR Code encontrado no campo: ${qrCode.substring(0, 50)}...`);
      } else {
        console.log('Nenhum QR code encontrado na resposta');
      }
    }
  } catch (error) {
    console.error('Erro ao obter QR code:', error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Dados: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// Executar o teste
getQrCode();