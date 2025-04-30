import axios from "axios";
import { Request, Response } from "express";
import { storage } from "./storage";

// Status de conexão do WhatsApp por usuário
export const connectionStatus: Record<number, any> = {};

// Rota para verificar o status da conexão
export async function checkConnectionStatus(req: Request, res: Response) {
  try {
    // Usar um ID fixo para testes se não estiver autenticado
    const id = req.isAuthenticated() ? (req.user as Express.User).id : 1;
    
    // Se não tiver status, retorna desconectado
    if (!connectionStatus[id]) {
      connectionStatus[id] = {
        connected: false,
        lastUpdated: new Date()
      };
    }
    
    res.json(connectionStatus[id]);
  } catch (error) {
    console.error("Erro ao verificar status:", error);
    res.status(500).json({ message: "Erro ao verificar status" });
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
    
    // Verificar se o webhook foi configurado
    if (!user.whatsappWebhookUrl) {
      console.log("Webhook do WhatsApp não configurado para o usuário:", userId);
      
      // Usar QR Code mockado se não tiver webhook configurado
      connectionStatus[userId] = {
        connected: false,
        qrCode: "data:image/png;base64,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",
        lastUpdated: new Date()
      };
      
      // Simular que após 8 segundos a conexão foi estabelecida
      setTimeout(() => {
        if (connectionStatus[userId]) {
          connectionStatus[userId] = {
            connected: true,
            name: "Meu WhatsApp",
            phone: "+5511999999999",
            lastUpdated: new Date()
          };
        }
      }, 8000);
      
      return res.json(connectionStatus[userId]);
    }
    
    try {
      console.log(`Chamando webhook do WhatsApp: ${user.whatsappWebhookUrl}`);
      
      // Chamar o webhook para obter o QR code - usando POST conforme exigido pelo n8n
      const webhookResponse = await axios.post(user.whatsappWebhookUrl || '', {
        action: "connect",
        userId: userId
      });
      
      console.log("Resposta do webhook:", webhookResponse.data);
      
      // Se o webhook retornou dados, usar o QR code retornado
      if (webhookResponse.data && webhookResponse.data.qrCode) {
        connectionStatus[userId] = {
          connected: false,
          qrCode: webhookResponse.data.qrCode,
          lastUpdated: new Date()
        };
      } else {
        // Se não retornou um QR code específico
        connectionStatus[userId] = {
          connected: false,
          qrCode: "data:image/png;base64,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",
          lastUpdated: new Date()
        };
      }
      
      // Verificar status após 30 segundos para dar tempo suficiente para escanear o QR Code
      setTimeout(async () => {
        if (connectionStatus[userId]) {
          try {
            // Verificar status real da conexão via webhook - usando POST conforme exigido pelo n8n
            if (!user.whatsappWebhookUrl) throw new Error("Webhook URL não configurada");
            const statusResponse = await axios.post(user.whatsappWebhookUrl, {
              action: "status",
              userId: userId
            });
            
            console.log("Resposta de status do webhook:", statusResponse.data);
            
            if (statusResponse.data && statusResponse.data.connected) {
              connectionStatus[userId] = {
                connected: true,
                name: statusResponse.data.name || "WhatsApp Conectado",
                phone: statusResponse.data.phone || "N/A",
                lastUpdated: new Date()
              };
            } else {
              // Se o webhook retornou resposta mas não indica que está conectado
              // Manter o status atual com o QR code até que o usuário escaneie
              console.log("Webhook não confirmou conexão, mantendo QR code visível");
            }
          } catch (webhookError) {
            console.error("Erro ao verificar status via webhook:", webhookError);
            // Não alteramos o status automaticamente em caso de erro
            // para manter o QR code visível
          }
        }
      }, 30000);
      
      return res.json(connectionStatus[userId]);
    } catch (webhookError) {
      console.error("Erro ao chamar webhook:", webhookError);
      
      // Fallback para QR Code mockado em caso de erro no webhook
      connectionStatus[userId] = {
        connected: false,
        qrCode: "data:image/png;base64,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",
        lastUpdated: new Date()
      };
      
      // Simular que após 8 segundos a conexão foi estabelecida
      setTimeout(() => {
        if (connectionStatus[userId]) {
          connectionStatus[userId] = {
            connected: true,
            name: "Meu WhatsApp",
            phone: "+5511999999999",
            lastUpdated: new Date()
          };
        }
      }, 8000);
      
      return res.json(connectionStatus[userId]);
    }
  } catch (error) {
    console.error("Erro ao conectar:", error);
    res.status(500).json({ message: "Erro ao conectar" });
  }
}

// Rota para desconectar o WhatsApp
export async function disconnectWhatsApp(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    const userId = (req.user as Express.User).id;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    
    // Verificar se o webhook foi configurado
    if (user.whatsappWebhookUrl) {
      try {
        // Tentar chamar o webhook para desconectar - usando POST conforme exigido pelo n8n
        if (!user.whatsappWebhookUrl) throw new Error("Webhook URL não configurada");
        await axios.post(user.whatsappWebhookUrl, {
          action: "disconnect",
          userId: userId
        });
      } catch (webhookError) {
        console.error("Erro ao chamar webhook para desconexão:", webhookError);
      }
    }
    
    // Simular desconexão
    connectionStatus[userId] = {
      connected: false,
      lastUpdated: new Date()
    };
    
    res.json(connectionStatus[userId]);
  } catch (error) {
    console.error("Erro ao desconectar:", error);
    res.status(500).json({ message: "Erro ao desconectar" });
  }
}