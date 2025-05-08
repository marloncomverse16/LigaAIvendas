/**
 * API para obter templates de mensagem da Meta API Cloud
 */
import { Request, Response } from "express";
import { getMetaApiTemplates } from "../meta-whatsapp-api";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { settings } from "@shared/schema";

/**
 * Obtém os templates do WhatsApp aprovados pela Meta
 * para o usuário atual
 */
export async function getUserMetaTemplates(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Não autenticado" });
  }

  try {
    // Obtém as configurações do usuário (que contém as credenciais da Meta API)
    const userId = req.user.id;
    
    // Buscar configurações do usuário
    const [userSettings] = await db
      .select()
      .from(settings)
      .where(eq(settings.userId, userId));
    
    if (!userSettings) {
      return res.status(400).json({ message: "Configurações do usuário não encontradas" });
    }
    
    // Verificar se as credenciais da Meta API estão configuradas
    if (!userSettings.whatsappMetaToken || !userSettings.whatsappMetaBusinessId) {
      return res.status(400).json({ message: "API da Meta não configurada. Configure nas Configurações." });
    }
    
    // Obter templates da API da Meta
    const result = await getMetaApiTemplates(
      userSettings.whatsappMetaToken,
      userSettings.whatsappMetaBusinessId,
      userSettings.whatsappMetaApiVersion || "v18.0"
    );
    
    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }
    
    // Filtra apenas templates APPROVED para exibir
    const approvedTemplates = result.templates.filter(template => 
      template.status === "APPROVED"
    );
    
    return res.status(200).json(approvedTemplates);
  } catch (error) {
    console.error("Erro ao buscar templates da Meta API:", error);
    return res.status(500).json({ message: "Erro ao buscar templates da Meta API" });
  }
}