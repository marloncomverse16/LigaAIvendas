import { db } from "../db";
import { userServers } from "@shared/schema";
import { eq } from "drizzle-orm";

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
    // Buscar dados do usuário_servidor com as configurações da Meta
    const [userServer] = await db.select()
      .from(userServers)
      .where(eq(userServers.userId, userId))
      .limit(1);
    
    if (!userServer) {
      return {
        success: false,
        error: "Usuário não possui configuração de servidor"
      };
    }
    
    // Verificar se os campos da Meta estão configurados
    if (!userServer.whatsappMetaToken || !userServer.whatsappMetaBusinessId) {
      return {
        success: false,
        error: "Configuração da Meta API incompleta (token ou business ID faltando)"
      };
    }
    
    // Retornar os dados da Meta
    return {
      success: true,
      token: userServer.whatsappMetaToken,
      businessId: userServer.whatsappMetaBusinessId,
      phoneNumberId: userServer.whatsappMetaPhoneNumberId || undefined,
      apiVersion: userServer.whatsappMetaApiVersion || "v18.0" // Usa v18.0 como padrão se não estiver definido
    };
  } catch (error) {
    console.error("Erro ao obter configuração Meta do usuário:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao buscar configuração"
    };
  }
}