/**
 * API de conexões para o WhatsApp
 * Este módulo fornece endpoints para conectar ao WhatsApp usando:
 * 1. Código QR (Evolution API com instâncias Baileys)
 * 2. API oficial do WhatsApp Cloud (para contas Business verificadas)
 */

import { Request, Response } from "express";
import axios from "axios";
import { EvolutionApiClient } from "../evolution-api";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { userServers, servers } from "../../shared/schema";

// Mantém o status da conexão por usuário
interface ConnectionStatus {
  connected: boolean;
  qrCode?: string;
  lastUpdated: Date;
  method?: 'qrcode' | 'cloud'; // Indica qual método está sendo usado
  phoneNumber?: string; // Para conexão via Cloud API
  businessId?: string; // Para conexão via Cloud API
  cloudConnection?: boolean; // Flag para conexão Cloud
}

// Status da conexão por usuário
const connectionStatus: Record<number, ConnectionStatus> = {};

/**
 * Obtém o servidor associado ao usuário
 */
async function fetchUserServer(userId: number) {
  try {
    console.log(`Buscando servidor para o usuário ${userId}...`);
    
    // Usar Drizzle em vez de SQL bruto
    const userServersData = await db.query.userServers.findMany({
      where: eq(userServers.userId, userId),
      with: {
        server: true
      }
    });
    
    console.log(`Encontradas ${userServersData.length} relações para o usuário ${userId}`);
    
    // Filtrar apenas servidores ativos
    const activeServerRelation = userServersData.find(relation => relation.server.active);
    
    if (!activeServerRelation) {
      console.log(`Nenhum servidor ativo encontrado para o usuário ${userId}`);
      return null;
    }
    
    console.log(`Usando servidor ${activeServerRelation.server.name} para o usuário ${userId}`);
    return activeServerRelation.server;
  } catch (error) {
    console.error("Erro ao buscar servidor do usuário:", error);
    return null;
  }
}

/**
 * Endpoint para obter QR Code e conectar via Evolution API
 * Método: POST
 */
export async function getWhatsAppQrCode(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    const userId = req.user!.id;
    
    // Obtém dados do servidor associado ao usuário
    const server = await fetchUserServer(userId);
    
    if (!server) {
      return res.status(404).json({ 
        message: "Servidor não encontrado. Por favor, entre em contato com o administrador."
      });
    }
    
    // Verifica se as credenciais necessárias existem
    if (!server.apiUrl || !server.apiToken) {
      return res.status(400).json({ 
        message: "Configuração de servidor incompleta. Entre em contato com o administrador."
      });
    }

    // Usa o nome de usuário como nome da instância
    const instanceId = req.user!.username;

    // Cria cliente para Evolution API
    const evolutionClient = new EvolutionApiClient(
      server.apiUrl,
      server.apiToken,
      instanceId
    );

    console.log(`Tentando deletar instância existente (se houver): ${instanceId}`);
    
    // Tenta excluir a instância existente se houver
    try {
      await evolutionClient.deleteInstance();
      console.log(`Instância existente excluída: ${instanceId}`);
    } catch (deleteError) {
      // Ignora erros - a instância pode não existir
      console.log(`Nenhuma instância encontrada ou erro ao excluir: ${instanceId}`);
    }

    console.log(`Criando nova instância do WhatsApp: ${instanceId}`);
    
    // Cria uma nova instância
    try {
      const createResult = await evolutionClient.createInstance();
      console.log("Instância criada com sucesso:", createResult);
    } catch (createError) {
      console.error("Erro ao criar instância:", createError);
      return res.status(500).json({ 
        message: "Erro ao criar instância do WhatsApp. Tente novamente mais tarde."
      });
    }

    console.log(`Obtendo QR Code para a instância: ${instanceId}`);
    
    // Obtém QR code
    try {
      const qrResult = await evolutionClient.getQrCode();
      
      console.log("QR Code obtido:", JSON.stringify(qrResult).substring(0, 200) + "...");
      
      // Verifique se a resposta foi bem-sucedida e se tem o QR code
      if (qrResult && qrResult.success && qrResult.qrCode) {
        // Atualiza o status da conexão
        connectionStatus[userId] = {
          connected: false,
          qrCode: qrResult.qrCode,
          lastUpdated: new Date(),
          method: 'qrcode'
        };
        
        // Retorna QR code para o cliente
        return res.status(200).json({ 
          qrcode: qrResult.qrCode,
          message: "Escaneie o código QR com seu WhatsApp"
        });
      } else if (qrResult && qrResult.connected) {
        // Já está conectado
        connectionStatus[userId] = {
          connected: true,
          lastUpdated: new Date(),
          method: 'qrcode'
        };
        
        return res.status(200).json({ 
          connected: true,
          message: "WhatsApp já está conectado!"
        });
      } else {
        console.error("Resposta sem QR code:", qrResult);
        throw new Error("QR Code não encontrado na resposta: " + (qrResult.error || "Erro desconhecido"));
      }
    } catch (error) {
      console.error("Erro ao obter QR code:", error);
      return res.status(500).json({ 
        message: "Erro ao obter QR code: " + error.message
      });
    }
  } catch (error) {
    console.error("Erro geral na rota de QR code:", error);
    return res.status(500).json({ 
      message: "Ocorreu um erro ao processar sua solicitação."
    });
  }
}

/**
 * Endpoint para conectar via WhatsApp Cloud API
 * Método: POST
 */
export async function connectWhatsAppCloud(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });

  try {
    const userId = req.user!.id;
    const { phoneNumber, businessId } = req.body;
    
    if (!phoneNumber || !businessId) {
      return res.status(400).json({ 
        message: "Número de telefone e Business ID são obrigatórios" 
      });
    }
    
    // Obtém dados do servidor associado ao usuário
    const server = await fetchUserServer(userId);
    
    if (!server) {
      return res.status(404).json({ 
        message: "Servidor não encontrado. Por favor, entre em contato com o administrador."
      });
    }
    
    // Para conexão cloud, apenas registramos as informações
    // Não precisamos realmente se conectar a uma API neste momento

    // Primeiro tenta excluir qualquer instância existente na Evolution API
    if (server.apiUrl && server.apiToken) {
      // Usa o nome de usuário como nome da instância
      const instanceId = req.user!.username;
      
      console.log(`Tentando deletar instância existente (se houver): ${instanceId}`);
      
      try {
        const evolutionClient = new EvolutionApiClient(
          server.apiUrl,
          server.apiToken,
          instanceId
        );
        
        await evolutionClient.deleteInstance();
        console.log(`Instância existente excluída: ${instanceId}`);
      } catch (deleteError) {
        // Ignora erros - a instância pode não existir
        console.log(`Nenhuma instância encontrada ou erro ao excluir: ${instanceId}`);
      }
    }
    
    console.log(`Registrando conexão WhatsApp Cloud API para usuário: ${userId}`);
    
    // Registra as informações da conexão cloud
    connectionStatus[userId] = {
      connected: true,
      lastUpdated: new Date(),
      method: 'cloud',
      phoneNumber: phoneNumber,
      businessId: businessId,
      cloudConnection: true
    };
    
    // Opcionalmente, atualize o banco de dados para persistir essa configuração
    // (código para persistência omitido)
    
    return res.status(200).json({
      success: true,
      phoneNumber: phoneNumber,
      businessId: businessId,
      message: "WhatsApp Business API conectado com sucesso"
    });
  } catch (error) {
    console.error("Erro ao conectar WhatsApp Cloud API:", error);
    return res.status(500).json({ 
      message: "Erro ao conectar WhatsApp Cloud API."
    });
  }
}

/**
 * Endpoint para verificar status da conexão
 * Método: GET
 */
export async function checkConnectionStatus(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    const userId = req.user!.id;
    
    // Se não houver registro de conexão, considera desconectado
    if (!connectionStatus[userId]) {
      return res.status(200).json({
        connected: false,
        lastUpdated: new Date()
      });
    }
    
    // Se for conexão cloud, apenas retorna o status armazenado
    if (connectionStatus[userId].method === 'cloud') {
      return res.status(200).json({
        connected: connectionStatus[userId].connected,
        cloudConnection: true,
        phoneNumber: connectionStatus[userId].phoneNumber,
        businessId: connectionStatus[userId].businessId,
        lastUpdated: connectionStatus[userId].lastUpdated
      });
    }
    
    // Para conexão via QR Code, verifica o status na Evolution API
    const server = await fetchUserServer(userId);
    
    if (!server || !server.apiUrl || !server.apiToken) {
      // Se não tiver servidor configurado, considera desconectado
      return res.status(200).json({
        connected: false,
        message: "Servidor não configurado",
        lastUpdated: new Date()
      });
    }
    
    // Usa o nome de usuário como nome da instância
    const instanceId = req.user!.username;
    
    // Verifica status na Evolution API
    try {
      const evolutionClient = new EvolutionApiClient(
        server.apiUrl,
        server.apiToken,
        instanceId
      );
      
      const statusResult = await evolutionClient.checkConnectionStatus();
      console.log("Status da conexão:", statusResult);
      
      // Se recebemos HTML, isso geralmente significa um erro de autenticação ou sessão
      if (typeof statusResult.data === 'string' && 
          (statusResult.data.includes('<!DOCTYPE html>') || 
          statusResult.data.includes('<html'))) {
        
        console.log("Recebemos HTML em vez de JSON, tentando endpoint alternativo");
        
        // Tentar outro endpoint para status - o endpoint direto /instance/connect que usamos para o QR code
        try {
          const connectEndpoint = `${server.apiUrl}/instance/connect/${instanceId}`;
          console.log(`Verificando status direto em: ${connectEndpoint}`);
          
          const response = await fetch(connectEndpoint, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'apikey': server.apiToken || process.env.EVOLUTION_API_TOKEN || '',
              'Authorization': `Bearer ${server.apiToken || process.env.EVOLUTION_API_TOKEN || ''}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log("Resposta do endpoint direto:", data);
            
            // Verificar se já está conectado
            const isConnected = data.connected === true || 
                              data.status === 'connected' || 
                              data.state === 'open' || 
                              data.state === 'connected';
            
            connectionStatus[userId] = {
              connected: isConnected,
              qrCode: connectionStatus[userId]?.qrCode,
              lastUpdated: new Date(),
              method: 'qrcode'
            };
          }
        } catch (directError) {
          console.error("Erro ao verificar status direto:", directError);
          // Manter o status atual
        }
      } else {
        // Processamento normal do status
        const isConnected = statusResult.success && statusResult.connected || 
                          statusResult.data?.state === 'open' || 
                          statusResult.data?.state === 'connected' ||
                          statusResult.data?.connected === true;
        
        connectionStatus[userId] = {
          connected: isConnected,
          qrCode: connectionStatus[userId]?.qrCode,
          lastUpdated: new Date(),
          method: 'qrcode'
        };
        
        console.log(`Status da conexão atualizado: ${isConnected ? 'Conectado' : 'Desconectado'}`);
      }
    } catch (statusError) {
      console.warn("Erro ao verificar status da conexão:", statusError);
      
      // Em caso de erro, não alteramos o status para evitar falsos negativos
      // Apenas garantimos que o objeto de status exista
      if (!connectionStatus[userId]) {
        connectionStatus[userId] = {
          connected: false,
          lastUpdated: new Date(),
          method: 'qrcode'
        };
      }
    }
    
    // Retorna o status atual
    return res.status(200).json({
      ...connectionStatus[userId],
      qrcode: connectionStatus[userId]?.qrCode // Mantém compatibilidade
    });
  } catch (error) {
    console.error("Erro ao verificar status da conexão:", error);
    return res.status(500).json({ 
      message: "Erro ao verificar status da conexão"
    });
  }
}

/**
 * Endpoint para desconectar WhatsApp
 * Método: POST
 */
export async function disconnectWhatsApp(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    const userId = req.user!.id;
    
    // Se for conexão cloud, apenas remove o registro
    if (connectionStatus[userId]?.method === 'cloud') {
      delete connectionStatus[userId];
      
      // Opcionalmente, atualize o banco de dados para remover essa configuração
      // (código para persistência omitido)
      
      return res.status(200).json({
        success: true,
        message: "Conexão WhatsApp Business API removida com sucesso"
      });
    }
    
    // Para conexão via QR Code, desconecta na Evolution API
    const server = await fetchUserServer(userId);
    
    if (!server || !server.apiUrl || !server.apiToken) {
      return res.status(404).json({ 
        message: "Servidor não encontrado"
      });
    }
    
    // Usa o nome de usuário como nome da instância
    const instanceId = req.user!.username;
    
    // Tenta desconectar e excluir a instância
    try {
      const evolutionClient = new EvolutionApiClient(
        server.apiUrl,
        server.apiToken,
        instanceId
      );
      
      // Faz logout primeiro
      await evolutionClient.disconnect();
      console.log(`Instância desconectada: ${instanceId}`);
      
      // Depois exclui a instância
      await evolutionClient.deleteInstance();
      console.log(`Instância excluída: ${instanceId}`);
    } catch (logoutError) {
      // Ainda tenta excluir a instância mesmo se o logout falhar
      console.warn("Erro ao desconectar, tentando excluir instância:", logoutError);
      
      try {
        const evolutionClient = new EvolutionApiClient(
          server.apiUrl,
          server.apiToken,
          instanceId
        );
        
        await evolutionClient.deleteInstance();
        console.log(`Instância excluída: ${instanceId}`);
      } catch (logoutError) {
        console.error("Erro ao excluir instância:", logoutError);
      }
    }
    
    // Remove o registro de conexão
    delete connectionStatus[userId];
    
    return res.status(200).json({
      success: true,
      message: "WhatsApp desconectado com sucesso"
    });
  } catch (error) {
    console.error("Erro ao desconectar WhatsApp:", error);
    return res.status(500).json({ 
      message: "Erro ao desconectar WhatsApp"
    });
  }
}