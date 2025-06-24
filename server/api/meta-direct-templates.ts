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
  
  // Declarar variáveis no escopo mais externo para uso no bloco de catch
  let token = '';
  let businessId = '';
  let apiVersion = 'v18.0';
  
  try {
    // Buscar configurações válidas do usuário 2 (usuário ativo)
    // Sempre usar o token mais recente da tabela settings
    const result = await pool.query(`
      SELECT 
        settings.user_id, 
        settings.whatsapp_meta_token, 
        settings.whatsapp_meta_business_id, 
        settings.whatsapp_meta_api_version
      FROM settings
      WHERE 
        settings.user_id = 2 AND
        settings.whatsapp_meta_token IS NOT NULL AND 
        settings.whatsapp_meta_token != '' AND
        settings.whatsapp_meta_business_id IS NOT NULL AND 
        settings.whatsapp_meta_business_id != ''
      ORDER BY settings.updated_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log("[META-DIRECT] Nenhum usuário com configuração Meta encontrado");
      return res.status(404).json({ 
        error: "Nenhum usuário com configuração Meta encontrado",
        success: false
      });
    }

    // Examinar todas as configurações disponíveis para encontrar a mais completa
    let bestConfig = null;
    let bestScore = 0;

    for (const config of result.rows) {
      // Calcular uma pontuação para cada configuração com base na completude
      let score = 0;
      
      // Token com formato correto (começa com EAA e tem mais de 50 caracteres)
      if (config.whatsapp_meta_token && config.whatsapp_meta_token.startsWith('EAA') && config.whatsapp_meta_token.length > 50) {
        score += 5;
      } else if (config.whatsapp_meta_api_version && config.whatsapp_meta_api_version.startsWith('EAA') && config.whatsapp_meta_api_version.length > 50) {
        // Token armazenado no campo errado (api_version)
        score += 4;
      }
      
      // ID do negócio com formato correto (numérico)
      if (config.whatsapp_meta_business_id && !isNaN(Number(config.whatsapp_meta_business_id))) {
        score += 3;
      }
      
      // Bonificação extra para pontuação
      score += 1;
      
      if (score > bestScore) {
        bestScore = score;
        bestConfig = config;
      }
    }

    if (!bestConfig) {
      // Se não encontrou nenhuma configuração adequada, usar a primeira
      bestConfig = result.rows[0];
    }

    const user = bestConfig;
    console.log("[META-DIRECT] Usando configuração do usuário ID:", user.user_id, "com pontuação:", bestScore);

    // Usar diretamente os valores da configuração (já foram corrigidos nas tabelas)
    token = user.whatsapp_meta_token || '';
    businessId = user.whatsapp_meta_business_id || '';
    apiVersion = user.whatsapp_meta_api_version || "v18.0";
    
    console.log("[META-DIRECT] Configuração carregada:");
    console.log("[META-DIRECT] - Token length:", token.length);
    console.log("[META-DIRECT] - Token prefix:", token.substring(0, 10) + "...");
    console.log("[META-DIRECT] - Business ID:", businessId);
    console.log("[META-DIRECT] - API Version:", apiVersion);

    // Validações básicas
    if (!token || token.length < 50) {
      console.log("[META-DIRECT] Token inválido ou muito curto");
      return res.status(400).json({
        error: "Token WhatsApp Meta API inválido. Configure um token válido em Configurações > Integrações",
        success: false
      });
    }

    if (!businessId || isNaN(Number(businessId))) {
      console.log("[META-DIRECT] Business ID inválido");
      return res.status(400).json({
        error: "Business ID inválido. Configure um Business ID válido em Configurações > Integrações",
        success: false
      });
    }

    // URL para buscar os templates
    const url = `https://graph.facebook.com/${apiVersion}/${businessId}/message_templates`;
    console.log(`[META-DIRECT] Fazendo requisição para: ${url}`);

    // Coletar todos os templates (com paginação)
    let allTemplates: MetaTemplate[] = [];
    let nextPageUrl: string | null = url;
    
    while (nextPageUrl) {
      console.log(`[META-DIRECT] Buscando página: ${nextPageUrl}`);
      
      // Fazer a requisição para a página atual
      const response = await axios.get(nextPageUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          limit: 250, // Usar limite maior para reduzir número de requisições
        },
      });
      
      if (!response.data || !response.data.data) {
        console.log("[META-DIRECT] Resposta não contém dados esperados:", response.data);
        break;
      }
      
      // Processar os templates desta página
      const pageTemplates: MetaTemplate[] = response.data.data.map((template: any) => ({
        id: template.id,
        name: template.name,
        status: template.status,
        category: template.category,
        components: template.components,
        language: template.language,
      }));
      
      console.log(`[META-DIRECT] Encontrados ${pageTemplates.length} templates nesta página`);
      
      // Adicionar à lista completa
      allTemplates = [...allTemplates, ...pageTemplates];
      
      // Verificar se há mais páginas
      if (response.data.paging && response.data.paging.next) {
        nextPageUrl = response.data.paging.next;
        console.log(`[META-DIRECT] Próxima página encontrada: ${nextPageUrl}`);
      } else {
        nextPageUrl = null;
        console.log(`[META-DIRECT] Sem mais páginas para buscar`);
      }
    }

    console.log(`[META-DIRECT] Total de ${allTemplates.length} templates encontrados em todas as páginas`);
    
    if (allTemplates.length > 0) {
      console.log(`[META-DIRECT] Primeiro template: ${allTemplates[0]?.name || 'nenhum'}`);
      
      if (allTemplates.length > 1) {
        console.log(`[META-DIRECT] Segundo template: ${allTemplates[1]?.name || 'nenhum'}`);
      }
      
      if (allTemplates.length > 2) {
        console.log(`[META-DIRECT] Terceiro template: ${allTemplates[2]?.name || 'nenhum'}`);
      }
    }

    // Retornar todos os templates aprovados
    const approvedTemplates = allTemplates.filter((t) => t.status === "APPROVED");
    console.log(`[META-DIRECT] ${approvedTemplates.length} templates aprovados do total de ${allTemplates.length}`);

    // Retornar diretamente o array de templates aprovados para compatibilidade com código existente
    return res.status(200).json(approvedTemplates);
  } catch (error: any) {
    console.error("[META-DIRECT] Erro ao buscar templates:", error.message);
    
    // Incluir detalhes de erro para ajudar no diagnóstico
    // Extrair detalhes específicos do erro da Meta API
    let errorMessage = "Erro desconhecido";
    let errorCode = "UNKNOWN";
    let valuesLikelySwapped = false;
    let suggestedFix = "";
    
    if (error.response?.data?.error) {
      // Formato de erro da Meta API
      errorMessage = error.response.data.error.message || "Erro na API";
      errorCode = error.response.data.error.code || error.response.status;
      
      console.log("[META-DIRECT] Erro específico da Meta API:", {
        message: errorMessage,
        code: errorCode,
        type: error.response.data.error.type
      });
      
      // Diagnóstico de possíveis problemas comuns com a API da Meta
      const errorCodeStr = String(errorCode);
      if (errorCodeStr === "190") {
        // Erro de autenticação - token inválido
        if (token.length < 50) {
          suggestedFix = "O token da API parece muito curto. Verifique se você está usando o 'Permanent Access Token' da Meta API.";
          valuesLikelySwapped = true;
        } else {
          suggestedFix = "Token de acesso inválido ou expirado. Gere um novo token na Meta Business Platform.";
        }
      } else if (errorCodeStr === "100") {
        // Parâmetro inválido
        if (businessId.length > 50) {
          suggestedFix = "O ID do negócio parece ser na verdade um token. Os campos podem estar invertidos nas configurações.";
          valuesLikelySwapped = true;
        } else if (isNaN(Number(businessId))) {
          suggestedFix = "O ID do negócio deve ser um valor numérico. Verifique a configuração.";
        }
      } else if (errorCodeStr === "803") {
        // ID do negócio inválido
        suggestedFix = "ID do negócio inválido. Verifique o ID correto no Meta Business Suite.";
      }
    }
    
    // Diagnóstico adicional para problemas de conexão
    if (!error.response && error.code === 'ENOTFOUND') {
      suggestedFix = "Não foi possível conectar ao servidor da Meta. Verifique sua conexão com a internet.";
    }
    
    const errorDetails = error.response 
      ? {
          status: error.response.status,
          statusText: error.response.statusText,
          message: errorMessage,
          code: errorCode,
          data: error.response.data,
          suggestedFix,
          valuesLikelySwapped,
          tokenLength: token.length,
          businessIdLength: businessId.length,
          apiVersion: apiVersion,
          tokenFormat: token.substring(0, 3) + "..." 
        }
      : { 
          message: error.message,
          suggestedFix,
          code: error.code || 'UNKNOWN'
        };
    
    return res.status(500).json({
      error: "Erro ao buscar templates",
      details: errorDetails,
      success: false
    });
  }
}