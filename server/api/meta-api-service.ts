import { db } from "../db";
import { userServers, servers } from "@shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * Serviço para obter as configurações do servidor Meta da API do usuário
 */

export interface UserServerMetaData {
  success: boolean;
  error?: string;
  token?: string;
  phoneNumberId?: string;
  businessId?: string;
  apiVersion?: string;
}

/**
 * Obtém as configurações de servidor do usuário para a Meta API
 * Incluindo token, business ID e phone number ID
 */
export async function getUserServer(userId: number): Promise<UserServerMetaData> {
  try {
    // Buscar dados do usuário e servidor com join para obter as configurações da Meta
    const result = await db
      .select({
        userServer: userServers,
        server: servers
      })
      .from(userServers)
      .innerJoin(servers, eq(userServers.serverId, servers.id))
      .where(eq(userServers.userId, userId))
      .limit(1);
    
    if (!result || result.length === 0) {
      return {
        success: false,
        error: "Usuário não possui configuração de servidor"
      };
    }
    
    const { userServer, server } = result[0];
    
    // Verificar se os campos da Meta estão configurados
    if (!server.whatsappMetaToken || !server.whatsappMetaBusinessId) {
      return {
        success: false,
        error: "Configuração da Meta API incompleta (token ou business ID faltando)"
      };
    }
    
    // Retornar os dados da Meta
    return {
      success: true,
      token: server.whatsappMetaToken,
      businessId: server.whatsappMetaBusinessId,
      phoneNumberId: userServer.metaPhoneNumberId || undefined,
      apiVersion: server.whatsappMetaApiVersion || "v18.0" // Usa v18.0 como padrão se não estiver definido
    };
  } catch (error) {
    console.error("Erro ao obter configuração Meta do usuário:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao buscar configuração"
    };
  }
}