/**
 * Sistema de monitoramento automático de conexões QR Code
 * Verifica periodicamente o status de conexão e dispara webhooks quando detecta mudanças
 */

import axios from 'axios';
import { storage } from '../storage';
import { sendQRConnectionWebhook, sendQRDisconnectionWebhook } from './qr-connection-webhook';

// Cache para armazenar o último estado de conexão de cada usuário
const lastConnectionState: Record<number, boolean> = {};

// Função para resetar cache de um usuário específico (para testes)
function resetUserCache(userId: number) {
  delete lastConnectionState[userId];
  console.log(`🔄 Cache resetado para usuário ${userId}`);
}

// Função para verificar status de conexão de um usuário específico
async function checkUserConnectionStatus(userId: number): Promise<boolean | null> {
  try {
    const user = await storage.getUser(userId);
    if (!user) {
      console.log(`⚠️ Usuário ${userId} não encontrado`);
      return null;
    }
    
    // Obter informações do servidor atual
    const userServer = await storage.getUserServers(userId);
    if (!userServer || userServer.length === 0 || !userServer[0].server) {
      console.log(`⚠️ Servidor não configurado para usuário ${userId}`);
      return null;
    }
    
    const server = userServer[0].server;
    const instanceName = user.username; // Usa o nome do usuário como instância
    
    // Verificar se temos as informações necessárias
    if (!server.apiUrl || !server.apiToken) {
      console.log(`⚠️ Configuração de API incompleta para usuário ${userId}`);
      return null;
    }
    
    // Configurar headers para a requisição usando o token do servidor
    const headers = {
      'Content-Type': 'application/json',
      'apikey': server.apiToken
    };
    
    try {
      const statusResponse = await axios.get(
        `${server.apiUrl}/instance/connectionState/${instanceName}`,
        { 
          headers,
          timeout: 10000 // 10 segundos de timeout
        }
      );
      
      // Verificar se está conectado corretamente
      const instanceState = statusResponse.data?.instance?.state || statusResponse.data?.state;
      const isConnected = instanceState === 'open' || 
                         instanceState === 'connected' || 
                         statusResponse.data?.connected === true ||
                         statusResponse.data?.instance?.connected === true;
      
      console.log(`📊 Usuário ${userId} (${user.username}): ${isConnected ? 'CONECTADO' : 'DESCONECTADO'}`);
      return isConnected;
      
    } catch (apiError) {
      console.log(`⚠️ Erro ao verificar status da API para usuário ${userId}: ${apiError.message}`);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ Erro ao verificar conexão do usuário ${userId}:`, error);
    return null;
  }
}

// Função para processar mudança de estado e enviar webhook
async function processStateChange(userId: number, previousState: boolean | undefined, currentState: boolean) {
  console.log(`🔍 Processando estado do usuário ${userId}: ${previousState} → ${currentState}`);
  
  // Detectar primeira conexão ou mudança de estado
  const firstConnection = previousState === undefined && currentState === true;
  const stateChanged = previousState !== undefined && previousState !== currentState;
  
  if (firstConnection || stateChanged) {
    console.log(`🔄 EVENTO DETECTADO para usuário ${userId}: ${previousState} → ${currentState}`);
    
    if ((previousState === undefined || !previousState) && currentState) {
      // Primeira conexão ou reconexão - disparar webhook de conexão
      console.log(`📤 Disparando webhook de CONEXÃO QR Code para usuário ${userId}...`);
      try {
        const success = await sendQRConnectionWebhook(userId);
        if (success) {
          console.log(`✅ Webhook de conexão enviado com sucesso para usuário ${userId}`);
        } else {
          console.log(`❌ Falha no envio do webhook de conexão para usuário ${userId}`);
        }
      } catch (webhookError) {
        console.error(`❌ Erro ao enviar webhook de conexão para usuário ${userId}:`, webhookError);
      }
    } else if (previousState && !currentState) {
      // Estado mudou de conectado para desconectado - disparar webhook de desconexão
      console.log(`📤 Disparando webhook de DESCONEXÃO QR Code para usuário ${userId}...`);
      try {
        const success = await sendQRDisconnectionWebhook(userId);
        if (success) {
          console.log(`✅ Webhook de desconexão enviado com sucesso para usuário ${userId}`);
        } else {
          console.log(`❌ Falha no envio do webhook de desconexão para usuário ${userId}`);
        }
      } catch (webhookError) {
        console.error(`❌ Erro ao enviar webhook de desconexão para usuário ${userId}:`, webhookError);
      }
    }
  } else {
    console.log(`ℹ️  Nenhuma mudança de estado relevante para usuário ${userId}`);
  }
  
  // Atualizar estado no cache
  lastConnectionState[userId] = currentState;
}

// Função para verificar todos os usuários ativos
async function checkAllUserConnections() {
  try {
    console.log(`🔍 [${new Date().toLocaleTimeString()}] Verificando conexões de todos os usuários...`);
    
    // Buscar todos os usuários ativos
    const users = await storage.getAllUsers();
    const activeUsers = users.filter(user => user.isActive !== false);
    
    console.log(`📊 Encontrados ${activeUsers.length} usuários ativos para verificação`);
    
    // Verificar cada usuário
    for (const user of activeUsers) {
      try {
        const previousState = lastConnectionState[user.id];
        const currentState = await checkUserConnectionStatus(user.id);
        
        console.log(`🔍 Usuário ${user.id} (${user.username}): estado anterior = ${previousState}, estado atual = ${currentState}`);
        
        // Processar mudança de estado (incluindo quando currentState é null = desconectado)
        if (currentState !== null || previousState !== undefined) {
          const normalizedCurrentState = currentState === null ? false : currentState;
          console.log(`🔧 Chamando processStateChange para usuário ${user.id}: ${previousState} → ${normalizedCurrentState}`);
          
          try {
            await processStateChange(user.id, previousState, normalizedCurrentState);
            console.log(`📊 Usuário ${user.id} (${user.username}): ${normalizedCurrentState ? 'CONECTADO' : 'DESCONECTADO'}`);
          } catch (processError) {
            console.error(`❌ Erro em processStateChange para usuário ${user.id}:`, processError);
          }
        } else {
          console.log(`⏭️  Pulando processStateChange para usuário ${user.id} (currentState=${currentState}, previousState=${previousState})`);
        }
      } catch (userError) {
        console.error(`❌ Erro ao processar usuário ${user.id}:`, userError);
      }
    }
    
    console.log(`✅ Verificação concluída às ${new Date().toLocaleTimeString()}`);
    
  } catch (error) {
    console.error('❌ Erro geral no monitoramento de conexões:', error);
  }
}

// Intervalo de verificação (em milissegundos) - 30 segundos
const CHECK_INTERVAL = 30000;

let monitoringInterval: NodeJS.Timeout | null = null;

// Função para iniciar o monitoramento automático
export function startConnectionMonitoring() {
  if (monitoringInterval) {
    console.log('⚠️ Monitoramento de conexões já está ativo');
    return;
  }
  
  console.log('🚀 Iniciando monitoramento automático de conexões QR Code...');
  
  // Executar verificação inicial
  checkAllUserConnections();
  
  // Configurar verificação periódica
  monitoringInterval = setInterval(checkAllUserConnections, CHECK_INTERVAL);
  
  console.log(`✅ Monitoramento iniciado - verificando a cada ${CHECK_INTERVAL/1000} segundos`);
}

// Função para parar o monitoramento automático
export function stopConnectionMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('🛑 Monitoramento automático de conexões parado');
  }
}

// Função para verificar status atual do monitoramento
export function getMonitoringStatus() {
  return {
    active: monitoringInterval !== null,
    interval: CHECK_INTERVAL,
    lastStates: { ...lastConnectionState }
  };
}

// Função para forçar verificação manual
export async function forceConnectionCheck() {
  console.log('🔄 Forçando verificação manual de conexões...');
  await checkAllUserConnections();
}

// Função para testar webhook manualmente
export async function testWebhookForUser(userId: number) {
  console.log(`🧪 Testando webhook para usuário ${userId}...`);
  
  // Resetar cache para forçar detecção de mudança
  resetUserCache(userId);
  
  // Verificar status atual
  const currentState = await checkUserConnectionStatus(userId);
  
  if (currentState !== null) {
    // Simular mudança de estado (undefined → currentState irá disparar webhook)
    await processStateChange(userId, undefined, currentState);
  }
  
  return currentState;
}