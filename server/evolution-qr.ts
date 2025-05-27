/**
 * Módulo específico para conexão QR Code com Evolution API
 * Baseado nos testes realizados que confirmaram os endpoints funcionais
 */

import axios from 'axios';

interface QRCodeResponse {
  success: boolean;
  qrCode?: string;
  error?: string;
  state?: string;
}

export async function initializeWhatsAppConnection(apiUrl: string, token: string, instance: string = 'admin'): Promise<QRCodeResponse> {
  const headers = { apikey: token };
  
  try {
    console.log(`[QR CODE] Iniciando conexão WhatsApp para instância: ${instance}`);
    
    // PASSO 1: Verificar se a instância existe e está pronta
    const stateResponse = await axios.get(`${apiUrl}/instance/connectionState/${instance}`, { headers });
    
    if (stateResponse.status !== 200) {
      return { success: false, error: `Erro ao verificar estado da instância: ${stateResponse.status}` };
    }
    
    console.log(`[QR CODE] Estado atual:`, stateResponse.data);
    const currentState = stateResponse.data?.instance?.state || stateResponse.data?.state;
    
    // Se já estiver conectado, retornar sucesso
    if (currentState === 'open' || currentState === 'connected') {
      return { success: true, state: currentState };
    }
    
    // PASSO 2: Se estiver em estado "connecting", tentar obter QR Code
    if (currentState === 'connecting' || currentState === 'close') {
      try {
        // Método 1: Tentar endpoint direto de QR Code
        const qrResponse = await axios.get(`${apiUrl}/instance/qrcode/${instance}`, { headers });
        
        if (qrResponse.status === 200 && qrResponse.data) {
          const qrCode = qrResponse.data.base64 || qrResponse.data.qrcode || qrResponse.data.code;
          if (qrCode) {
            console.log(`[QR CODE] QR Code obtido com sucesso`);
            return { success: true, qrCode, state: currentState };
          }
        }
      } catch (qrError) {
        console.log(`[QR CODE] Endpoint /qrcode não disponível, tentando método alternativo`);
      }
      
      // Método 2: Tentar iniciar conexão primeiro
      try {
        const connectResponse = await axios.post(`${apiUrl}/instance/restart/${instance}`, {}, { headers });
        
        if (connectResponse.status === 200 || connectResponse.status === 201) {
          console.log(`[QR CODE] Instância reiniciada, aguardando QR Code...`);
          
          // Aguardar um momento e tentar obter QR Code novamente
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const retryQrResponse = await axios.get(`${apiUrl}/instance/qrcode/${instance}`, { headers });
          
          if (retryQrResponse.status === 200 && retryQrResponse.data) {
            const qrCode = retryQrResponse.data.base64 || retryQrResponse.data.qrcode || retryQrResponse.data.code;
            if (qrCode) {
              console.log(`[QR CODE] QR Code obtido após reinicialização`);
              return { success: true, qrCode, state: 'connecting' };
            }
          }
        }
      } catch (restartError) {
        console.log(`[QR CODE] Erro ao reiniciar instância:`, restartError.message);
      }
    }
    
    // PASSO 3: Se a instância não existir, tentar criar
    if (currentState === 'close' || !currentState) {
      try {
        console.log(`[QR CODE] Criando nova instância: ${instance}`);
        
        const createResponse = await axios.post(`${apiUrl}/instance/create`, {
          instanceName: instance,
          webhook: null,
          webhookByEvents: false,
          qrcode: true
        }, { headers });
        
        if (createResponse.status === 200 || createResponse.status === 201) {
          console.log(`[QR CODE] Instância criada com sucesso`);
          
          // Aguardar a instância inicializar
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Tentar obter QR Code da nova instância
          const newQrResponse = await axios.get(`${apiUrl}/instance/qrcode/${instance}`, { headers });
          
          if (newQrResponse.status === 200 && newQrResponse.data) {
            const qrCode = newQrResponse.data.base64 || newQrResponse.data.qrcode || newQrResponse.data.code;
            if (qrCode) {
              console.log(`[QR CODE] QR Code obtido da nova instância`);
              return { success: true, qrCode, state: 'connecting' };
            }
          }
        }
      } catch (createError) {
        console.log(`[QR CODE] Erro ao criar instância:`, createError.message);
      }
    }
    
    return { 
      success: false, 
      error: `Não foi possível obter QR Code. Estado atual: ${currentState}`,
      state: currentState 
    };
    
  } catch (error) {
    console.error(`[QR CODE] Erro geral:`, error.message);
    return { success: false, error: error.message };
  }
}

export async function checkWhatsAppConnectionStatus(apiUrl: string, token: string, instance: string = 'admin') {
  const headers = { apikey: token };
  
  try {
    const response = await axios.get(`${apiUrl}/instance/connectionState/${instance}`, { headers });
    
    if (response.status === 200) {
      const state = response.data?.instance?.state || response.data?.state;
      const connected = state === 'open' || state === 'connected';
      
      return {
        connected,
        state,
        timestamp: new Date().toISOString()
      };
    }
    
    return { connected: false, state: 'unknown', timestamp: new Date().toISOString() };
  } catch (error) {
    console.error(`[QR STATUS] Erro ao verificar status:`, error.message);
    return { connected: false, state: 'error', error: error.message, timestamp: new Date().toISOString() };
  }
}