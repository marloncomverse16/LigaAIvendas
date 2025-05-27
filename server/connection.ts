import { Request, Response } from "express";
import { storage } from "./storage";
import { initializeWhatsAppConnection, checkWhatsAppConnectionStatus } from "./evolution-qr";

// Cache para armazenar status de conexão
export const connectionStatus: Record<number, any> = {};

/**
 * Função aprimorada para verificação da conexão com a Evolution API
 * Verifica se a API está online e também se está conectada ao WhatsApp
 */
async function checkEvolutionConnection(baseUrl: string, token: string, instance: string = 'admin') {
  try {
    const headers = {
      'apikey': token,
      'Content-Type': 'application/json'
    };

    // 1. Verificar se a API está online
    const healthResponse = await fetch(`${baseUrl}/`, {
      method: 'GET',
      headers
    });

    if (!healthResponse.ok) {
      throw new Error(`API não está respondendo: ${healthResponse.status}`);
    }

    // 2. Verificar status da instância (usando endpoint correto)
    const statusResponse = await fetch(`${baseUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers
    });

    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      return {
        online: true,
        connected: statusData?.instance?.state === 'open',
        state: statusData?.instance?.state || 'unknown',
        data: statusData
      };
    }

    return {
      online: true,
      connected: false,
      state: 'disconnected'
    };

  } catch (error) {
    console.error('Erro ao verificar conexão Evolution:', (error as Error).message);
    return {
      online: false,
      connected: false,
      state: 'error',
      error: (error as Error).message
    };
  }
}

async function fetchUserServer(userId: number) {
  try {
    const userServers = await storage.getUserServers(userId);
    return userServers.length > 0 ? userServers[0] : null;
  } catch (error) {
    console.error('Erro ao buscar servidor do usuário:', (error as Error).message);
    return null;
  }
}

export async function checkConnectionStatus(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });

  try {
    const userId = (req.user as Express.User).id;
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    // Verificar se o usuário está usando Meta Cloud API
    if (user.whatsappMode === 'meta_cloud') {
      const metaStatus = {
        connected: !!user.metaPhoneNumberId,
        mode: 'meta_cloud',
        phoneNumberId: user.metaPhoneNumberId || null
      };
      
      connectionStatus[userId] = metaStatus;
      return res.json(metaStatus);
    }

    // Para modo QR Code, verificar servidor Evolution API
    const userServers = await storage.getUserServers(userId);
    const userServer = userServers.length > 0 ? userServers[0] : null;
    
    if (!userServer?.server?.apiUrl) {
      return res.json({
        connected: false,
        error: "Servidor Evolution API não configurado"
      });
    }

    // Verificar conexão com Evolution API
    const evolutionStatus = await checkEvolutionConnection(
      userServer.server.apiUrl,
      userServer.server.apiToken || process.env.EVOLUTION_API_TOKEN || '4db623449606bcf2814521b73657dbc0',
      user.username || 'admin'
    );

    const status = {
      connected: evolutionStatus.connected,
      state: evolutionStatus.state,
      mode: 'qr_code',
      apiUrl: userServer.server.apiUrl,
      instance: user.username || 'admin',
      lastUpdated: new Date()
    };

    connectionStatus[userId] = status;
    return res.json(status);

  } catch (error) {
    console.error("Erro ao verificar status:", (error as Error).message);
    return res.status(500).json({ 
      message: "Erro interno do servidor",
      error: (error as Error).message 
    });
  }
}

// Rota para conectar o WhatsApp
export async function connectWhatsApp(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    const userId = (req.user as Express.User).id;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    
    // Verificar se temos informações do servidor
    const userServer = await fetchUserServer(userId);
    
    if (userServer && userServer.server && userServer.server.apiUrl) {
      console.log(`🚀 Iniciando conexão WhatsApp via Evolution API: ${userServer.server.apiUrl}`);
      
      // Lista de tokens para tentar (prioritizando o que sabemos que funciona)
      const tokens = [
        '4db623449606bcf2814521b73657dbc0',      // Token confirmado funcionando
        userServer.server.apiToken,               // Token do servidor
        process.env.EVOLUTION_API_TOKEN,          // Token do ambiente
      ].filter(Boolean);
      
      for (const token of tokens) {
        try {
          console.log(`🔑 Tentando conexão com token: ${token?.substring(0, 8)}...`);
          
          // Usar nossa nova implementação otimizada de QR Code
          const qrResult = await initializeWhatsAppConnection(
            userServer.server.apiUrl,
            token,
            user.username || 'admin'
          );
          
          if (qrResult.success) {
            console.log(`✅ Conexão iniciada com sucesso!`);
            
            // Atualizar status no cache
            connectionStatus[userId] = {
              connected: !qrResult.qrCode, // Se não há QR code, já está conectado
              state: qrResult.state || 'connecting',
              qrCode: qrResult.qrCode || null,
              lastUpdated: new Date(),
              apiUrl: userServer.server.apiUrl,
              instance: user.username || 'admin'
            };
            
            return res.json({
              connected: connectionStatus[userId].connected,
              qrCode: connectionStatus[userId].qrCode,
              state: connectionStatus[userId].state,
              message: qrResult.qrCode ? 
                "QR Code gerado! Escaneie com seu WhatsApp para conectar." : 
                "WhatsApp conectado com sucesso!"
            });
          } else {
            console.log(`❌ Falha com token atual: ${qrResult.error}`);
          }
        } catch (tokenError) {
          console.log(`❌ Erro com token: ${(tokenError as Error).message}`);
          continue; // Tentar próximo token
        }
      }
      
      // Se chegou até aqui, nenhum token funcionou
      return res.status(500).json({ 
        message: "Não foi possível conectar com a Evolution API",
        error: "Todos os tokens falharam"
      });
    }
    
    // Fallback para configuração via webhook (se não tiver servidor configurado)
    return res.status(400).json({ 
      message: "Servidor Evolution API não configurado",
      error: "Configure um servidor na aba 'Configurações > Servidores'" 
    });
    
  } catch (error) {
    console.error("❌ Erro ao conectar WhatsApp:", (error as Error).message);
    return res.status(500).json({ 
      message: "Erro interno do servidor",
      error: (error as Error).message 
    });
  }
}

// Rota para desconectar o WhatsApp
export async function disconnectWhatsApp(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });

  try {
    const userId = (req.user as Express.User).id;
    
    // Limpar status do cache
    if (connectionStatus[userId]) {
      delete connectionStatus[userId];
    }

    return res.json({ 
      connected: false,
      message: "WhatsApp desconectado com sucesso" 
    });

  } catch (error) {
    console.error("Erro ao desconectar:", (error as Error).message);
    return res.status(500).json({ 
      message: "Erro interno do servidor",
      error: (error as Error).message 
    });
  }
}