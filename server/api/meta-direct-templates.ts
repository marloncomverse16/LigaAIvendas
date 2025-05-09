/**
 * Módulo para acesso direto aos templates da Meta API
 * Esta implementação simplificada evita problemas com autenticação e middleware
 */
import { Request, Response } from "express";
import axios from "axios";
import { pool } from "../db";

// Interface simplificada para template da Meta
interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  components: any[];
  language: string;
}

/**
 * Endpoint para buscar templates diretamente sem autenticação
 * Útil para debugging e desenvolvimento
 */
export async function getMetaTemplatesDirectly(req: Request, res: Response) {
  console.log("[META-DIRECT] Iniciando busca direta de templates");
  
  try {
    // Buscar o primeiro usuário com token Meta configurado
    // As configurações estão na tabela 'settings', não na tabela 'users'
    const result = await pool.query(`
      SELECT 
        settings.user_id, 
        settings.whatsapp_meta_token, 
        settings.whatsapp_meta_business_id, 
        settings.whatsapp_meta_api_version
      FROM settings
      WHERE 
        settings.whatsapp_meta_token IS NOT NULL AND 
        settings.whatsapp_meta_token != '' AND
        settings.whatsapp_meta_business_id IS NOT NULL AND
        settings.whatsapp_meta_business_id != ''
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log("[META-DIRECT] Nenhum usuário com configuração Meta encontrado");
      return res.status(404).json({ 
        error: "Nenhum usuário com configuração Meta encontrado",
        success: false
      });
    }

    const user = result.rows[0];
    const token = user.whatsapp_meta_token;
    const businessId = user.whatsapp_meta_business_id;
    const apiVersion = user.whatsapp_meta_api_version || "v18.0";  // Default to v18.0 if not set

    // Verificando se os valores parecem estar em ordem
    if (token.length < 20) {
      console.log("[META-DIRECT] ALERTA: Token parece muito curto");
    }
    
    // Verificar se o businessId e token estão invertidos (um erro comum)
    let actualToken = token;
    let actualBusinessId = businessId;
    
    if (businessId.length > 60 && token.length < 30) {
      console.log("[META-DIRECT] ALERTA: BusinessId e Token parecem estar invertidos. Tentando corrigir...");
      // Trocar os valores
      actualToken = businessId;
      actualBusinessId = token;
      console.log("[META-DIRECT] Valores trocados para correção");
    }
    
    // Verificar formato do businessId (deve ser numérico)
    if (isNaN(Number(businessId))) {
      console.log("[META-DIRECT] ALERTA: BusinessId não é numérico:", businessId);
    }

    console.log(`[META-DIRECT] Usando usuário ID ${user.user_id} para buscar templates`);
    console.log(`[META-DIRECT] BusinessID: ${businessId}`);
    console.log(`[META-DIRECT] API Version: ${apiVersion}`);
    console.log(`[META-DIRECT] Token (primeiros 10 chars): ${token.substring(0, 10)}...`);

    // URL para buscar as mensagens templates
    const url = `https://graph.facebook.com/${apiVersion}/${actualBusinessId}/message_templates`;

    console.log(`[META-DIRECT] URL final: ${url}`);
    console.log(`[META-DIRECT] Token utilizado (primeiros 10 chars): ${actualToken.substring(0, 10)}...`);

    // Buscar templates da Meta API diretamente
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${actualToken}`,
      },
      params: {
        limit: 100,
      },
    });

    // Extrair apenas os dados necessários para evitar informações sensíveis
    const templates: MetaTemplate[] = response.data.data.map((template: any) => ({
      id: template.id,
      name: template.name,
      status: template.status,
      category: template.category,
      components: template.components,
      language: template.language,
    }));

    console.log(`[META-DIRECT] ${templates.length} templates encontrados`);
    console.log(`[META-DIRECT] Primeiro template: ${templates[0]?.name || 'nenhum'}`);

    // Retornar apenas os templates aprovados
    const approvedTemplates = templates.filter((t) => t.status === "APPROVED");
    console.log(`[META-DIRECT] ${approvedTemplates.length} templates aprovados`);

    return res.status(200).json(approvedTemplates);
  } catch (error: any) {
    console.error("[META-DIRECT] Erro ao buscar templates:", error.message);
    
    // Incluir detalhes de erro para ajudar no diagnóstico
    // Extrair detalhes específicos do erro da Meta API
    let errorMessage = "Erro desconhecido";
    let errorCode = "UNKNOWN";
    
    if (error.response?.data?.error) {
      // Formato de erro da Meta API
      errorMessage = error.response.data.error.message || "Erro na API";
      errorCode = error.response.data.error.code || error.response.status;
      console.log("[META-DIRECT] Erro específico da Meta API:", {
        message: errorMessage,
        code: errorCode,
        type: error.response.data.error.type
      });
    }
    
    const errorDetails = error.response 
      ? {
          status: error.response.status,
          statusText: error.response.statusText,
          message: errorMessage,
          code: errorCode,
          data: error.response.data
        }
      : { message: error.message };
    
    return res.status(500).json({
      error: "Erro ao buscar templates",
      details: errorDetails,
      success: false
    });
  }
}