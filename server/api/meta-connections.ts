/**
 * API de conexões para o WhatsApp Cloud API (Meta)
 * Este módulo fornece endpoints para conectar diretamente ao WhatsApp Cloud API da Meta
 */

import { Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { users, servers, userServers } from "../../shared/schema";
import { MetaWhatsAppClient } from "../meta-whatsapp-api";

// Mantém o status da conexão por usuário
interface MetaConnectionStatus {
  connected: boolean;
  phoneNumberId: string;
  businessId: string;
  accessToken: string;
  apiVersion: string;
  lastUpdated: Date;
  businessName?: string;
  businessPhoneNumber?: string;
}

// Status da conexão por usuário
const metaConnectionStatus: Record<number, MetaConnectionStatus> = {};

/**
 * Obtém o servidor associado ao usuário
 */
async function fetchUserServerForMeta(userId: number) {
  try {
    console.log(`Buscando servidor para o usuário ${userId} (Meta WhatsApp Cloud API)...`);
    
    // Usar Drizzle para obter servidor
    const userServersData = await db.query.userServers.findMany({
      where: eq(userServers.userId, userId),
      with: {
        server: true
      }
    });
    
    console.log(`Encontradas ${userServersData.length} relações para o usuário ${userId}`);
    
    // Filtrar apenas servidores ativos com tokens para Meta WhatsApp API
    const activeServerRelation = userServersData.find(
      relation => relation.server.active && relation.server.metaWhatsappAccessToken
    );
    
    if (!activeServerRelation) {
      console.log(`Nenhum servidor ativo com token da Meta API encontrado para o usuário ${userId}`);
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
 * Endpoint para conectar via WhatsApp Cloud API da Meta
 * Método: POST
 */
export async function connectWhatsAppMeta(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });

  try {
    const userId = req.user!.id;
    const { phoneNumberId } = req.body;
    
    if (!phoneNumberId) {
      return res.status(400).json({ 
        message: "Identificação do número de telefone é obrigatória" 
      });
    }
    
    // Obtém dados do servidor associado ao usuário
    const server = await fetchUserServerForMeta(userId);
    
    if (!server) {
      return res.status(404).json({ 
        message: "Servidor com configuração Meta WhatsApp não encontrado. Por favor, entre em contato com o administrador."
      });
    }
    
    // Verifica se as credenciais necessárias existem
    if (!server.metaWhatsappAccessToken) {
      return res.status(400).json({ 
        message: "Token de acesso da API da Meta não configurado. Entre em contato com o administrador."
      });
    }

    const apiVersion = server.metaWhatsappApiVersion || "v18.0";
    
    console.log(`Tentando conectar ao WhatsApp Cloud API da Meta com phone_number_id: ${phoneNumberId}`);
    
    // Cria cliente para Meta API
    const metaClient = new MetaWhatsAppClient(
      server.metaWhatsappAccessToken,
      phoneNumberId,
      apiVersion
    );
    
    // Verifica se a conexão é válida
    const verifyResult = await metaClient.verifyConnection();
    
    console.log("Resultado da verificação de conexão Meta:", JSON.stringify(verifyResult));
    
    if (!verifyResult.success || !verifyResult.connected) {
      return res.status(400).json({ 
        message: "Falha ao conectar com a API do WhatsApp. Verifique a identificação do número e o token de acesso.",
        details: verifyResult.error || "Token inválido ou número não encontrado"
      });
    }
    
    // Extrair as informações importantes
    const businessName = verifyResult.data?.name || verifyResult.data?.display_phone_number || "";
    const businessPhoneNumber = verifyResult.data?.display_phone_number || "";
    
    // Salva os dados da conexão no banco de dados
    await db.update(users)
      .set({
        whatsappPhoneNumberId: phoneNumberId,
        whatsappBusinessId: verifyResult.data?.id || ""
      })
      .where(eq(users.id, userId));
    
    // Atualiza o status da conexão em memória
    metaConnectionStatus[userId] = {
      connected: true,
      phoneNumberId: phoneNumberId,
      businessId: verifyResult.data?.id || "",
      accessToken: server.metaWhatsappAccessToken,
      apiVersion: apiVersion,
      lastUpdated: new Date(),
      businessName: businessName,
      businessPhoneNumber: businessPhoneNumber
    };
    
    // Retorna os dados de conexão
    return res.status(200).json({
      success: true,
      connected: true,
      phoneNumberId: phoneNumberId,
      businessId: verifyResult.data?.id || "",
      businessName: businessName,
      businessPhoneNumber: businessPhoneNumber,
      message: "WhatsApp Business API conectado com sucesso"
    });
  } catch (error: any) {
    console.error("Erro ao conectar WhatsApp Meta API:", error);
    return res.status(500).json({ 
      message: "Erro ao conectar WhatsApp Meta API: " + (error.message || "Erro desconhecido")
    });
  }
}

/**
 * Endpoint para verificar status da conexão Meta
 * Método: GET
 */
export async function checkMetaConnectionStatus(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    const userId = req.user!.id;
    
    // Se não houver registro de conexão, verifica no banco de dados
    if (!metaConnectionStatus[userId]) {
      const userData = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
      
      if (!userData || !userData.whatsappPhoneNumberId) {
        return res.status(200).json({
          connected: false,
          message: "Nenhuma conexão Meta WhatsApp Cloud API configurada"
        });
      }
      
      // Obtém dados do servidor
      const server = await fetchUserServerForMeta(userId);
      
      if (!server || !server.metaWhatsappAccessToken) {
        return res.status(200).json({
          connected: false,
          message: "Token de acesso da API da Meta não configurado"
        });
      }
      
      // Cria cliente para verificar conexão
      const metaClient = new MetaWhatsAppClient(
        server.metaWhatsappAccessToken,
        userData.whatsappPhoneNumberId,
        server.metaWhatsappApiVersion || "v18.0"
      );
      
      // Verifica conexão
      const verifyResult = await metaClient.verifyConnection();
      
      if (verifyResult.success && verifyResult.connected) {
        // Salva o status da conexão em memória
        metaConnectionStatus[userId] = {
          connected: true,
          phoneNumberId: userData.whatsappPhoneNumberId,
          businessId: userData.whatsappBusinessId || verifyResult.data?.id || "",
          accessToken: server.metaWhatsappAccessToken,
          apiVersion: server.metaWhatsappApiVersion || "v18.0",
          lastUpdated: new Date(),
          businessName: verifyResult.data?.name || verifyResult.data?.display_phone_number || "",
          businessPhoneNumber: verifyResult.data?.display_phone_number || ""
        };
        
        return res.status(200).json({
          connected: true,
          phoneNumberId: userData.whatsappPhoneNumberId,
          businessName: metaConnectionStatus[userId].businessName,
          businessPhoneNumber: metaConnectionStatus[userId].businessPhoneNumber,
          lastUpdated: new Date()
        });
      } else {
        return res.status(200).json({
          connected: false,
          phoneNumberId: userData.whatsappPhoneNumberId,
          message: "Conexão inválida ou expirada",
          lastUpdated: new Date()
        });
      }
    }
    
    // Usa o status em memória, mas também verifica se ainda é válido
    const connectionInfo = metaConnectionStatus[userId];
    
    // Verificar a conexão a cada 30 minutos (1800000 ms)
    const shouldVerify = !connectionInfo.lastUpdated || 
                         (new Date().getTime() - connectionInfo.lastUpdated.getTime() > 1800000);
    
    if (shouldVerify) {
      console.log(`Verificando novamente a conexão Meta para o usuário ${userId}...`);
      
      try {
        // Cria cliente para verificar conexão
        const metaClient = new MetaWhatsAppClient(
          connectionInfo.accessToken,
          connectionInfo.phoneNumberId,
          connectionInfo.apiVersion
        );
        
        // Verifica conexão
        const verifyResult = await metaClient.verifyConnection();
        
        if (verifyResult.success && verifyResult.connected) {
          // Atualiza o status
          metaConnectionStatus[userId] = {
            ...connectionInfo,
            connected: true,
            lastUpdated: new Date(),
            businessName: verifyResult.data?.name || verifyResult.data?.display_phone_number || connectionInfo.businessName,
            businessPhoneNumber: verifyResult.data?.display_phone_number || connectionInfo.businessPhoneNumber
          };
          
          return res.status(200).json({
            connected: true,
            phoneNumberId: connectionInfo.phoneNumberId,
            businessName: metaConnectionStatus[userId].businessName,
            businessPhoneNumber: metaConnectionStatus[userId].businessPhoneNumber,
            lastUpdated: metaConnectionStatus[userId].lastUpdated
          });
        } else {
          // Mantém os dados mas marca como desconectado
          metaConnectionStatus[userId] = {
            ...connectionInfo,
            connected: false,
            lastUpdated: new Date()
          };
          
          return res.status(200).json({
            connected: false,
            phoneNumberId: connectionInfo.phoneNumberId,
            message: "Conexão inválida ou expirada",
            lastUpdated: new Date()
          });
        }
      } catch (error) {
        console.error("Erro ao verificar status da conexão Meta:", error);
        
        // Em caso de erro, considera desconectado
        return res.status(200).json({
          connected: false,
          phoneNumberId: connectionInfo.phoneNumberId,
          message: "Erro ao verificar conexão",
          lastUpdated: connectionInfo.lastUpdated
        });
      }
    }
    
    // Se a verificação não é necessária, retorna o status atual
    return res.status(200).json({
      connected: connectionInfo.connected,
      phoneNumberId: connectionInfo.phoneNumberId,
      businessName: connectionInfo.businessName,
      businessPhoneNumber: connectionInfo.businessPhoneNumber,
      lastUpdated: connectionInfo.lastUpdated
    });
  } catch (error) {
    console.error("Erro ao verificar status da conexão Meta:", error);
    return res.status(500).json({ 
      message: "Erro ao verificar status da conexão"
    });
  }
}

/**
 * Endpoint para desconectar WhatsApp Meta API
 * Método: POST
 */
export async function disconnectWhatsAppMeta(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    const userId = req.user!.id;
    
    // Remove os dados da conexão do banco de dados
    await db.update(users)
      .set({
        whatsappPhoneNumberId: null,
        whatsappBusinessId: null
      })
      .where(eq(users.id, userId));
    
    // Remove o status da conexão em memória
    delete metaConnectionStatus[userId];
    
    return res.status(200).json({
      success: true,
      message: "Conexão WhatsApp Business API desconectada com sucesso"
    });
  } catch (error) {
    console.error("Erro ao desconectar WhatsApp Meta API:", error);
    return res.status(500).json({ 
      message: "Erro ao desconectar WhatsApp Meta API"
    });
  }
}

/**
 * Endpoint para enviar mensagem via WhatsApp Meta API
 * Método: POST
 */
export async function sendMetaWhatsAppMessage(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    const userId = req.user!.id;
    const { to, message, templateName, language, components } = req.body;
    
    if ((!to || !message) && (!to || !templateName)) {
      return res.status(400).json({ 
        message: "Destinatário e mensagem ou template são obrigatórios" 
      });
    }
    
    // Verifica se há uma conexão ativa
    if (!metaConnectionStatus[userId] || !metaConnectionStatus[userId].connected) {
      // Tenta obter do banco de dados
      const userData = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
      
      if (!userData || !userData.whatsappPhoneNumberId) {
        return res.status(400).json({
          message: "Nenhuma conexão WhatsApp ativa. Conecte-se primeiro."
        });
      }
      
      // Obtém dados do servidor
      const server = await fetchUserServerForMeta(userId);
      
      if (!server || !server.metaWhatsappAccessToken) {
        return res.status(400).json({
          message: "Token de acesso da API da Meta não configurado"
        });
      }
      
      metaConnectionStatus[userId] = {
        connected: true,
        phoneNumberId: userData.whatsappPhoneNumberId,
        businessId: userData.whatsappBusinessId || "",
        accessToken: server.metaWhatsappAccessToken,
        apiVersion: server.metaWhatsappApiVersion || "v18.0",
        lastUpdated: new Date()
      };
    }
    
    // Cria cliente para Meta API
    const metaClient = new MetaWhatsAppClient(
      metaConnectionStatus[userId].accessToken,
      metaConnectionStatus[userId].phoneNumberId,
      metaConnectionStatus[userId].apiVersion
    );
    
    // Envia a mensagem
    if (templateName) {
      // Mensagem de template
      const result = await metaClient.sendTemplateMessage(
        to, 
        templateName, 
        language || "pt_BR", 
        components || []
      );
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          messageId: result.messageId,
          message: "Mensagem de template enviada com sucesso"
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Erro ao enviar mensagem de template",
          details: result.error || "Erro desconhecido"
        });
      }
    } else {
      // Mensagem de texto simples
      const result = await metaClient.sendTextMessage(to, message);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          messageId: result.messageId,
          message: "Mensagem enviada com sucesso"
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Erro ao enviar mensagem",
          details: result.error || "Erro desconhecido"
        });
      }
    }
  } catch (error: any) {
    console.error("Erro ao enviar mensagem WhatsApp Meta API:", error);
    return res.status(500).json({ 
      message: "Erro ao enviar mensagem: " + (error.message || "Erro desconhecido")
    });
  }
}