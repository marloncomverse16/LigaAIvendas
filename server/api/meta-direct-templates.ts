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
    const result = await pool.query(`
      SELECT 
        users.id, 
        users.whatsapp_meta_token, 
        users.whatsapp_meta_business_id, 
        users.whatsapp_meta_api_version
      FROM users
      WHERE 
        users.whatsapp_meta_token IS NOT NULL AND 
        users.whatsapp_meta_token != '' AND
        users.whatsapp_meta_business_id IS NOT NULL AND
        users.whatsapp_meta_business_id != ''
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

    console.log(`[META-DIRECT] Usando usuário ID ${user.id} para buscar templates`);
    console.log(`[META-DIRECT] BusinessID: ${businessId}, API Version: ${apiVersion}`);

    // URL para buscar as mensagens templates
    const url = `https://graph.facebook.com/${apiVersion}/${businessId}/message_templates`;

    // Buscar templates da Meta API diretamente
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
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
    const errorDetails = error.response 
      ? {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
        }
      : { message: error.message };
    
    return res.status(500).json({
      error: "Erro ao buscar templates",
      details: errorDetails,
      success: false
    });
  }
}