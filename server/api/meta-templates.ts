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
    console.log("GET /api/user/meta-templates: Usuário não autenticado");
    return res.status(401).json({ message: "Não autenticado" });
  }

  try {
    // Obtém as configurações do usuário (que contém as credenciais da Meta API)
    const userId = req.user.id;
    console.log(`GET /api/user/meta-templates: Processando para usuário ${userId}`);
    
    // Buscar configurações do usuário
    const [userSettings] = await db
      .select()
      .from(settings)
      .where(eq(settings.userId, userId));
    
    console.log(`GET /api/user/meta-templates: Configurações encontradas: ${userSettings ? 'Sim' : 'Não'}`);
    
    // Imprimir todas as colunas encontradas para diagnóstico
    if (userSettings) {
      console.log("Colunas disponíveis nas configurações:");
      Object.keys(userSettings).forEach(key => {
        // Não mostrar o token completo para segurança
        const value = key === 'whatsappMetaToken' 
          ? (userSettings[key] ? `${userSettings[key].substring(0, 5)}...` : 'null')
          : userSettings[key];
        console.log(`  ${key}: ${value}`);
      });
    }
    
    if (!userSettings) {
      console.log("GET /api/user/meta-templates: Configurações não encontradas");
      return res.status(400).json({ message: "Configurações do usuário não encontradas" });
    }
    
    // Verificar se as credenciais da Meta API estão configuradas
    const hasToken = !!userSettings.whatsappMetaToken;
    const hasBusinessId = !!userSettings.whatsappMetaBusinessId;
    console.log(`GET /api/user/meta-templates: Token configurado: ${hasToken}, Business ID configurado: ${hasBusinessId}`);
    
    // Imprimir valores parciais para diagnóstico (protegendo dados sensíveis)
    if (hasToken) {
      const tokenSample = userSettings.whatsappMetaToken!.substring(0, 10) + "...";
      console.log(`Token (amostra): ${tokenSample}`);
    }
    
    if (hasBusinessId) {
      console.log(`Business ID: ${userSettings.whatsappMetaBusinessId}`);
    }
    
    console.log(`API Version: ${userSettings.whatsappMetaApiVersion || "v18.0 (padrão)"}`);
    
    if (!hasToken || !hasBusinessId) {
      console.log("GET /api/user/meta-templates: Credenciais da Meta API não configuradas");
      return res.status(400).json({ 
        message: "API da Meta não configurada. Configure em Integrações > WhatsApp Cloud API (Meta).",
        requiredConfig: {
          hasToken,
          hasBusinessId,
          configPage: "Integrações"
        }
      });
    }
    
    // Obter templates da API da Meta
    console.log(`GET /api/user/meta-templates: Chamando getMetaApiTemplates com token=${hasToken ? '***' : 'null'}, businessId=${userSettings.whatsappMetaBusinessId}, apiVersion=${userSettings.whatsappMetaApiVersion || "v18.0"}`);
    
    const result = await getMetaApiTemplates(
      userSettings.whatsappMetaToken!,
      userSettings.whatsappMetaBusinessId!,
      userSettings.whatsappMetaApiVersion || "v18.0"
    );
    
    console.log(`GET /api/user/meta-templates: Resultado da API: success=${result.success}, templates=${result.templates ? result.templates.length : 0}`);
    console.log("Resposta completa da Meta API:", JSON.stringify(result));
    
    if (!result.success) {
      console.log(`GET /api/user/meta-templates: Erro na API: ${result.error}`);
      return res.status(400).json({ 
        message: `Erro ao buscar templates: ${result.error}`,
        error: result.error,
        configStatus: {
          token: hasToken,
          businessId: hasBusinessId
        }
      });
    }
    
    // Filtra apenas templates APPROVED para exibir
    const approvedTemplates = result.templates.filter((template: any) => 
      template && template.status === "APPROVED"
    );
    
    console.log(`GET /api/user/meta-templates: Templates aprovados: ${approvedTemplates.length}`);
    
    // Se não encontrar templates, retorna um array vazio com detalhes
    if (approvedTemplates.length === 0) {
      console.log("GET /api/user/meta-templates: Nenhum template aprovado encontrado");
      return res.status(200).json({
        templates: [],
        message: "Nenhum template aprovado encontrado. Crie templates no painel do WhatsApp Business.",
        totalFound: result.templates ? result.templates.length : 0,
        approved: 0
      });
    }
    
    return res.status(200).json(approvedTemplates);
  } catch (error) {
    console.error("Erro ao buscar templates da Meta API:", error);
    return res.status(500).json({ message: "Erro ao buscar templates da Meta API" });
  }
}