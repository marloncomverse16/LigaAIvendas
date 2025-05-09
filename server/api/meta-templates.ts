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
    
    if (!userSettings) {
      console.log("GET /api/user/meta-templates: Configurações não encontradas");
      return res.status(400).json({ message: "Configurações do usuário não encontradas" });
    }
    
    // Verificar se as credenciais da Meta API estão configuradas
    const hasToken = !!userSettings.whatsappMetaToken;
    const hasBusinessId = !!userSettings.whatsappMetaBusinessId;
    console.log(`GET /api/user/meta-templates: Token configurado: ${hasToken}, Business ID configurado: ${hasBusinessId}`);
    
    if (!hasToken || !hasBusinessId) {
      console.log("GET /api/user/meta-templates: Credenciais da Meta API não configuradas");
      return res.status(400).json({ 
        message: "API da Meta não configurada. Configure nas Configurações > WhatsApp Cloud API (Meta)." 
      });
    }
    
    // Obter templates da API da Meta
    console.log(`GET /api/user/meta-templates: Chamando getMetaApiTemplates com token=${hasToken ? '***' : 'null'}, businessId=${userSettings.whatsappMetaBusinessId}, apiVersion=${userSettings.whatsappMetaApiVersion || "v18.0"}`);
    
    try {
      const result = await getMetaApiTemplates(
        userSettings.whatsappMetaToken!,
        userSettings.whatsappMetaBusinessId!,
        userSettings.whatsappMetaApiVersion || "v18.0"
      );
      
      console.log(`GET /api/user/meta-templates: Resultado da API: success=${result.success}, templates=${result.templates ? result.templates.length : 0}`);
      
      if (!result.success) {
        console.log(`GET /api/user/meta-templates: Erro na API: ${result.error}`);
        return res.status(400).json({ message: result.error });
      }
      
      // Filtra apenas templates APPROVED para exibir
      const approvedTemplates = result.templates.filter((template: any) => 
        template && template.status === "APPROVED"
      );
      
      console.log(`GET /api/user/meta-templates: Templates aprovados: ${approvedTemplates.length}`);
      
      return res.status(200).json(approvedTemplates);
    } catch (apiError) {
      console.error("GET /api/user/meta-templates: Erro na chamada à API da Meta:", apiError);
      
      // Tentar verificar se as credenciais estão corretas tentando acessar informações básicas da conta
      try {
        console.log("GET /api/user/meta-templates: Tentando verificar credenciais com chamada direta à API");
        
        const testEndpoint = `https://graph.facebook.com/${userSettings.whatsappMetaApiVersion || 'v18.0'}/${userSettings.whatsappMetaBusinessId}`;
        const response = await fetch(testEndpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${userSettings.whatsappMetaToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error("GET /api/user/meta-templates: Falha no teste de credenciais:", errorData);
          return res.status(400).json({ 
            message: "Erro de autenticação com a API da Meta. Verifique seu token e ID da conta.", 
            error: errorData.error?.message || "Erro desconhecido" 
          });
        }
        
        // Se passou no teste, mas não conseguiu templates, pode ser que não haja templates configurados
        return res.status(200).json([]);
      } catch (testError) {
        console.error("GET /api/user/meta-templates: Erro no teste de credenciais:", testError);
        return res.status(500).json({ 
          message: "Não foi possível verificar as credenciais da Meta API." 
        });
      }
    }
  } catch (error) {
    console.error("Erro ao buscar templates da Meta API:", error);
    return res.status(500).json({ message: "Erro ao buscar templates da Meta API" });
  }
}