/**
 * Módulo para fornecer configurações do servidor do usuário para o frontend
 */

import { Request, Response } from "express";
import { storage } from "../storage";

/**
 * Obtém as configurações de servidor do usuário atual
 * Usado para configurar a conexão do frontend com a API Evolution
 */
export async function getUserServerConfig(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  
  try {
    const userId = (req.user as Express.User).id;
    const userServers = await storage.getUserServers(userId);
    
    if (!userServers || userServers.length === 0 || !userServers[0].server) {
      return res.status(400).json({ 
        message: "Servidor não configurado para este usuário",
        success: false
      });
    }
    
    const server = userServers[0].server;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ 
        message: "Usuário não encontrado",
        success: false 
      });
    }
    
    // Configuração para o cliente usar com a API Evolution
    const config = {
      apiUrl: server.apiUrl || "",
      apiToken: server.apiToken || "",
      instanceId: user.username || "admin", // Usa o nome do usuário como ID da instância
      success: true
    };
    
    return res.status(200).json(config);
  } catch (error: any) {
    console.error("Erro ao obter configurações do servidor:", error);
    return res.status(500).json({
      message: "Erro ao obter configurações do servidor",
      error: error.message,
      success: false
    });
  }
}