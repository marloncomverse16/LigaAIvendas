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
      console.log(`GET /api/user/meta-templates: Configurações não encontradas para usuário ${userId}`);
      return res.status(400).json({ 
        message: "Configurações não encontradas. Configure suas credenciais em Configurações > Integrações",
        needsConfiguration: true
      });
    }
    
    // Verificar se as credenciais da Meta API estão configuradas para este usuário
    const hasToken = !!userSettings.whatsappMetaToken;
    const hasBusinessId = !!userSettings.whatsappMetaBusinessId;
    console.log(`GET /api/user/meta-templates: Usuário ${userId} - Token: ${hasToken}, Business ID: ${hasBusinessId}`);
    
    if (!hasToken || !hasBusinessId) {
      console.log(`GET /api/user/meta-templates: Credenciais incompletas para usuário ${userId}`);
      return res.status(400).json({ 
        message: "Configure suas credenciais WhatsApp Meta API em Configurações > Integrações",
        needsConfiguration: true
      });
    }
    
    // Obter templates da API da Meta usando as configurações específicas do usuário
    console.log(`GET /api/user/meta-templates: Usuário ${userId} chamando API com BusinessID=${userSettings.whatsappMetaBusinessId}, API Version=${userSettings.whatsappMetaApiVersion || "v18.0"}`);
    
    try {
      const result = await getMetaApiTemplates(
        userSettings.whatsappMetaToken!,
        userSettings.whatsappMetaBusinessId!,
        userSettings.whatsappMetaApiVersion || "v18.0"
      );
      
      console.log(`GET /api/user/meta-templates: Usuário ${userId} - Resultado: success=${result.success}, templates=${result.templates ? result.templates.length : 0}`);
      
      if (!result.success) {
        console.log(`GET /api/user/meta-templates: Usuário ${userId} - Erro na API: ${result.error}`);
        return res.status(400).json({ 
          message: result.error,
          needsConfiguration: result.error.includes('token') || result.error.includes('expired')
        });
      }
      
      // Filtra apenas templates APPROVED para o usuário
      const approvedTemplates = result.templates.filter((template: any) => 
        template && template.status === "APPROVED"
      );
      
      console.log(`GET /api/user/meta-templates: Usuário ${userId} - Templates aprovados: ${approvedTemplates.length}`);
      
      return res.status(200).json(approvedTemplates);
    } catch (apiError) {
      console.error(`GET /api/user/meta-templates: Usuário ${userId} - Erro na chamada à API da Meta:`, apiError);
      
      // Verificar se as credenciais do usuário estão corretas
      try {
        console.log(`GET /api/user/meta-templates: Usuário ${userId} - Testando credenciais`);
        
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
          console.error(`GET /api/user/meta-templates: Usuário ${userId} - Credenciais inválidas:`, errorData);
          return res.status(400).json({ 
            message: "Credenciais WhatsApp Meta API inválidas. Verifique suas configurações em Configurações > Integrações", 
            error: errorData.error?.message || "Token ou Business ID inválido",
            needsConfiguration: true
          });
        }
        
        // Credenciais válidas mas sem templates configurados
        console.log(`GET /api/user/meta-templates: Usuário ${userId} - Credenciais válidas, mas sem templates`);
        return res.status(200).json([]);
      } catch (testError) {
        console.error(`GET /api/user/meta-templates: Usuário ${userId} - Erro no teste:`, testError);
        return res.status(500).json({ 
          message: "Erro ao verificar credenciais da Meta API",
          needsConfiguration: true
        });
      }
    }
  } catch (error) {
    console.error(`Erro ao buscar templates da Meta API para usuário ${req.user?.id}:`, error);
    return res.status(500).json({ 
      message: "Erro interno ao buscar templates da Meta API",
      needsConfiguration: true
    });
  }
}