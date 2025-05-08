/**
 * API de conexões para o WhatsApp Cloud API (Meta)
 * Este módulo fornece endpoints para conectar diretamente ao WhatsApp Cloud API da Meta
 */

import { Request, Response } from "express";
import axios from "axios";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { users, servers } from "@shared/schema";

// Status das conexões
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

// Mapeamento de status de conexão por usuário
const metaConnectionStatus: Record<number, MetaConnectionStatus> = {};

/**
 * Obtém o servidor associado ao usuário
 */
async function fetchUserServerForMeta(userId: number) {
  try {
    // Busca o usuário para obter informações de conexão Meta
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        server: {
          columns: {
            id: true,
            name: true,
            apiUrl: true,
            apiToken: true,
            whatsappMetaToken: true,
            whatsappMetaBusinessId: true,
            whatsappMetaApiVersion: true
          }
        }
      }
    });

    if (!user || !user.server) {
      throw new Error("Usuário não possui servidor configurado");
    }

    return {
      user,
      server: user.server
    };
  } catch (error) {
    console.error("Erro ao buscar servidor do usuário para Meta:", error);
    throw error;
  }
}

/**
 * Verifica a validade do token de acesso com a API da Meta
 */
async function verifyMetaAccessToken(accessToken: string, businessId: string, apiVersion: string = "v18.0") {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/${apiVersion}/${businessId}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );
    
    return {
      valid: true,
      businessName: response.data?.name || "Business Account",
      businessId: response.data?.id || businessId
    };
  } catch (error) {
    console.error("Erro ao verificar token da Meta:", error);
    throw new Error("Token de acesso inválido ou expirado");
  }
}

/**
 * Endpoint para conectar via WhatsApp Cloud API da Meta
 * Método: POST
 */
export async function connectWhatsAppMeta(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const { phoneNumberId } = req.body;
    
    if (!phoneNumberId) {
      return res.status(400).json({ error: "ID do número de telefone do WhatsApp é obrigatório" });
    }

    // Obtém servidor e usuário
    const { user, server } = await fetchUserServerForMeta(userId);

    if (!server.whatsappMetaToken) {
      return res.status(400).json({ 
        error: "Token de acesso da Meta não configurado. Solicite ao administrador para configurar no servidor." 
      });
    }

    if (!server.whatsappMetaBusinessId) {
      return res.status(400).json({ 
        error: "ID de negócios da Meta não configurado. Solicite ao administrador para configurar no servidor." 
      });
    }

    const apiVersion = server.whatsappMetaApiVersion || "v18.0";

    // Verifica a validade do token da Meta
    const tokenVerification = await verifyMetaAccessToken(
      server.whatsappMetaToken, 
      server.whatsappMetaBusinessId,
      apiVersion
    );

    // Verifica se o número de telefone existe na conta
    try {
      const phoneCheck = await axios.get(
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`,
        {
          headers: {
            "Authorization": `Bearer ${server.whatsappMetaToken}`,
            "Content-Type": "application/json"
          }
        }
      );

      // Atualiza o usuário com as informações da conexão
      await db.update(users)
        .set({
          whatsappMetaPhoneNumberId: phoneNumberId,
          whatsappMetaConnected: true,
          whatsappMetaConnectedAt: new Date()
        })
        .where(eq(users.id, userId));

      // Armazena o status da conexão
      metaConnectionStatus[userId] = {
        connected: true,
        phoneNumberId: phoneNumberId,
        businessId: server.whatsappMetaBusinessId,
        accessToken: server.whatsappMetaToken,
        apiVersion: apiVersion,
        lastUpdated: new Date(),
        businessName: tokenVerification.businessName,
        businessPhoneNumber: phoneCheck.data?.display_phone_number || phoneCheck.data?.verified_name || ""
      };

      return res.status(200).json({
        success: true,
        connected: true,
        phoneNumberId: phoneNumberId,
        businessName: tokenVerification.businessName,
        businessPhoneNumber: phoneCheck.data?.display_phone_number || phoneCheck.data?.verified_name || ""
      });
    } catch (error) {
      console.error("Erro ao verificar número de telefone:", error);
      return res.status(400).json({ 
        error: "Não foi possível verificar o número de telefone fornecido. Verifique se o ID está correto." 
      });
    }
  } catch (error) {
    console.error("Erro ao conectar com WhatsApp Meta:", error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : "Erro ao conectar com WhatsApp Meta" 
    });
  }
}

/**
 * Endpoint para verificar status da conexão Meta
 * Método: GET
 */
export async function checkMetaConnectionStatus(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    // Verifica se há um status de conexão armazenado
    if (metaConnectionStatus[userId] && metaConnectionStatus[userId].connected) {
      // Atualiza o timestamp da última verificação
      metaConnectionStatus[userId].lastUpdated = new Date();
      return res.status(200).json(metaConnectionStatus[userId]);
    }

    // Se não tiver armazenado, verifica no banco de dados
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        whatsappMetaConnected: true,
        whatsappMetaPhoneNumberId: true,
        whatsappMetaConnectedAt: true
      },
      with: {
        server: {
          columns: {
            whatsappMetaToken: true,
            whatsappMetaBusinessId: true,
            whatsappMetaApiVersion: true
          }
        }
      }
    });

    if (user?.whatsappMetaConnected && user.whatsappMetaPhoneNumberId && user.server?.whatsappMetaToken) {
      try {
        // Verificar se o token ainda é válido
        const apiVersion = user.server.whatsappMetaApiVersion || "v18.0";
        const tokenVerification = await verifyMetaAccessToken(
          user.server.whatsappMetaToken,
          user.server.whatsappMetaBusinessId || "",
          apiVersion
        );

        // Obter informações do número de telefone
        const phoneCheck = await axios.get(
          `https://graph.facebook.com/${apiVersion}/${user.whatsappMetaPhoneNumberId}`,
          {
            headers: {
              "Authorization": `Bearer ${user.server.whatsappMetaToken}`,
              "Content-Type": "application/json"
            }
          }
        );

        // Atualiza o cache de status
        const status = {
          connected: true,
          phoneNumberId: user.whatsappMetaPhoneNumberId,
          businessId: user.server.whatsappMetaBusinessId || "",
          accessToken: user.server.whatsappMetaToken,
          apiVersion: apiVersion,
          lastUpdated: new Date(),
          businessName: tokenVerification.businessName,
          businessPhoneNumber: phoneCheck.data?.display_phone_number || phoneCheck.data?.verified_name || ""
        };

        metaConnectionStatus[userId] = status;
        return res.status(200).json(status);
      } catch (error) {
        // Se não conseguir validar a conexão, marca como desconectado
        await db.update(users)
          .set({
            whatsappMetaConnected: false,
            whatsappMetaConnectedAt: null
          })
          .where(eq(users.id, userId));

        return res.status(200).json({ connected: false, lastUpdated: new Date() });
      }
    }

    return res.status(200).json({ connected: false, lastUpdated: new Date() });
  } catch (error) {
    console.error("Erro ao verificar status da conexão Meta:", error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : "Erro ao verificar status da conexão" 
    });
  }
}

/**
 * Endpoint para desconectar WhatsApp Meta API
 * Método: POST
 */
export async function disconnectWhatsAppMeta(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    // Atualiza o usuário para remover as informações de conexão
    await db.update(users)
      .set({
        whatsappMetaConnected: false,
        whatsappMetaConnectedAt: null
      })
      .where(eq(users.id, userId));

    // Remove o status de conexão armazenado
    if (metaConnectionStatus[userId]) {
      delete metaConnectionStatus[userId];
    }

    return res.status(200).json({ success: true, message: "Desconectado com sucesso" });
  } catch (error) {
    console.error("Erro ao desconectar WhatsApp Meta:", error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : "Erro ao desconectar WhatsApp Meta" 
    });
  }
}

/**
 * Endpoint para enviar mensagem via WhatsApp Meta API
 * Método: POST
 */
export async function sendMetaWhatsAppMessage(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const { to, message, messageType = "text" } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ error: "Destinatário e mensagem são obrigatórios" });
    }

    // Obtém as informações de conexão armazenadas ou do banco de dados
    let connection = metaConnectionStatus[userId];
    
    if (!connection || !connection.connected) {
      // Tenta buscar do banco de dados
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          whatsappMetaConnected: true,
          whatsappMetaPhoneNumberId: true
        },
        with: {
          server: {
            columns: {
              whatsappMetaToken: true,
              whatsappMetaBusinessId: true,
              whatsappMetaApiVersion: true
            }
          }
        }
      });

      if (!user?.whatsappMetaConnected || !user.whatsappMetaPhoneNumberId || !user.server?.whatsappMetaToken) {
        return res.status(400).json({ error: "Usuário não está conectado ao WhatsApp Meta" });
      }

      connection = {
        connected: true,
        phoneNumberId: user.whatsappMetaPhoneNumberId,
        businessId: user.server.whatsappMetaBusinessId || "",
        accessToken: user.server.whatsappMetaToken,
        apiVersion: user.server.whatsappMetaApiVersion || "v18.0",
        lastUpdated: new Date()
      };
    }

    // Formata o número para o padrão internacional (se necessário)
    let formattedNumber = to;
    if (!to.startsWith("+")) {
      formattedNumber = `+${to.replace(/\D/g, "")}`;
    }

    // Prepara o payload da mensagem de acordo com o tipo
    let messagePayload;
    if (messageType === "text") {
      messagePayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedNumber,
        type: "text",
        text: { body: message }
      };
    } else if (messageType === "template") {
      // Implementação de mensagem com template
      messagePayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedNumber,
        type: "template",
        template: { name: message, language: { code: "pt_BR" } }
      };
    } else {
      return res.status(400).json({ error: "Tipo de mensagem não suportado" });
    }

    // Envia a mensagem através da API da Meta
    const response = await axios.post(
      `https://graph.facebook.com/${connection.apiVersion}/${connection.phoneNumberId}/messages`,
      messagePayload,
      {
        headers: {
          "Authorization": `Bearer ${connection.accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.status(200).json({
      success: true,
      messageId: response.data?.messages?.[0]?.id,
      response: response.data
    });
  } catch (error) {
    console.error("Erro ao enviar mensagem via WhatsApp Meta:", error);
    
    const errorMessage = error.response?.data?.error?.message || 
                         (error instanceof Error ? error.message : "Erro desconhecido");
    
    return res.status(500).json({ 
      error: errorMessage,
      details: error.response?.data
    });
  }
}