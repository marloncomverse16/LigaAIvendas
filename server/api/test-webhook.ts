/**
 * Rota para testar diretamente o envio para o webhook de contatos
 */

import { Request, Response } from "express";
import { db } from "../db";
import { servers } from "@shared/schema";
import { notifyContactsWebhook } from "./webhook-notifier";

export async function testContactsWebhook(req: Request, res: Response) {
  try {
    const { serverId } = req.params;
    
    // Verificar autenticação
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    
    // Verificar papel de admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: "Acesso não autorizado" });
    }
    
    console.log(`Iniciando teste de webhook para o servidor ${serverId} pelo usuário ${req.user.id}`);
    
    // Notificar webhook com dados de teste
    const result = await notifyContactsWebhook(
      Number(serverId),
      req.user.id,
      req.user.username,
      'test_webhook',
      {
        test: true,
        message: "Teste manual de webhook",
        timestamp: new Date().toISOString()
      }
    );
    
    if (result) {
      return res.status(200).json({ 
        success: true, 
        message: "Webhook de contatos notificado com sucesso"
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        message: "Falha ao notificar webhook de contatos. Verifique os logs para mais detalhes."
      });
    }
  } catch (error: any) {
    console.error("Erro ao testar webhook:", error.message);
    
    return res.status(500).json({
      success: false,
      message: "Erro ao testar webhook",
      error: error.message
    });
  }
}