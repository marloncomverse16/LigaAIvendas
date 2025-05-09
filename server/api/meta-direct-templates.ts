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
    // Vamos atualizar as variáveis declaradas no escopo externo
    token = user.whatsapp_meta_token;
    businessId = user.whatsapp_meta_business_id;
    apiVersion = user.whatsapp_meta_api_version || "v18.0";  // Default to v18.0 if not set
    
    // Variáveis que serão potencialmente modificadas durante a detecção de problemas
    let actualToken = token;
    let actualBusinessId = businessId;
    let actualApiVersion = apiVersion;
    let valuesSwapped = false;
    
    // Verificando se os valores parecem estar em ordem
    if (token.length < 20) {
      console.log("[META-DIRECT] ALERTA: Token parece muito curto, apenas", token.length, "caracteres");
    }
    
    // Logging das informações para debug
    console.log("[META-DIRECT] Token length:", token.length);
    console.log("[META-DIRECT] BusinessId length:", businessId.length);
    console.log("[META-DIRECT] API Version value:", apiVersion);
    
    // Verificar formato do businessId (deve ser numérico)
    const businessIdIsNumeric = !isNaN(Number(businessId));
    const tokenIsNumeric = !isNaN(Number(token));
    
    // Verificar se o apiVersion pode estar no lugar errado (outro erro comum)
    const apiVersionMisplaced = apiVersion.startsWith("EAA") || apiVersion.length > 50;
    
    // Testes para detectar inversão de token/businessId
    const businessIdLooksLikeToken = businessId.length > 50 || businessId.includes("EAA");
    const tokenLooksLikeBusinessId = token.length < 30 && tokenIsNumeric;
    const apiVersionLooksLikeBusinessId = !apiVersionMisplaced && apiVersion.length < 30 && !isNaN(Number(apiVersion));
    
    console.log("[META-DIRECT] Diagnóstico: businessIdIsNumeric:", businessIdIsNumeric);
    console.log("[META-DIRECT] Diagnóstico: tokenIsNumeric:", tokenIsNumeric);
    console.log("[META-DIRECT] Diagnóstico: businessIdLooksLikeToken:", businessIdLooksLikeToken);
    console.log("[META-DIRECT] Diagnóstico: tokenLooksLikeBusinessId:", tokenLooksLikeBusinessId);
    console.log("[META-DIRECT] Diagnóstico: apiVersionMisplaced:", apiVersionMisplaced);
    
    // Caso 1: BusinessId e Token estão invertidos
    if ((businessIdLooksLikeToken && tokenLooksLikeBusinessId) || 
        (businessId.length > 50 && token.length < 30 && tokenIsNumeric)) {
      console.log("[META-DIRECT] ALERTA: BusinessId e Token parecem estar invertidos.");
      actualToken = businessId;
      actualBusinessId = token;
      valuesSwapped = true;
      console.log("[META-DIRECT] Valores invertidos: BusinessId e Token trocados.");
    } 
    // Caso 2: API Version contém o token
    else if (apiVersionMisplaced) {
      console.log("[META-DIRECT] ALERTA: API Version parece conter um token de acesso.");
      actualToken = apiVersion;
      actualApiVersion = "v18.0"; // Usar valor padrão para API
      console.log("[META-DIRECT] Usando API Version padrão (v18.0) e movendo o valor original para token.");
    } 
    // Caso 3: BusinessId não é numérico
    else if (!businessIdIsNumeric && !valuesSwapped) {
      console.log("[META-DIRECT] ALERTA: BusinessId não é numérico:", businessId);
      
      // Se o token parece ser numérico, pode ser outro caso de inversão
      if (tokenIsNumeric && token.length < 30) {
        console.log("[META-DIRECT] ALERTA: Token parece ser um businessId válido. Invertendo...");
        actualToken = businessId;
        actualBusinessId = token;
        valuesSwapped = true;
      }
      // Se API version parece ser um businessId, também verificar
      else if (apiVersionLooksLikeBusinessId) {
        console.log("[META-DIRECT] ALERTA: API Version parece ser um businessId válido. Ajustando...");
        actualBusinessId = apiVersion;
        actualApiVersion = "v18.0";
      }
    }

    console.log(`[META-DIRECT] Usando usuário ID ${user.user_id} para buscar templates`);
    console.log(`[META-DIRECT] BusinessID: ${businessId}`);
    console.log(`[META-DIRECT] API Version: ${apiVersion}`);
    console.log(`[META-DIRECT] Token (primeiros 10 chars): ${token.substring(0, 10)}...`);

    // URL para buscar as mensagens templates
    const url = `https://graph.facebook.com/${actualApiVersion}/${actualBusinessId}/message_templates`;

    console.log(`[META-DIRECT] URL final: ${url}`);
    console.log(`[META-DIRECT] Token utilizado (primeiros 10 chars): ${actualToken.substring(0, 10)}...`);
    console.log(`[META-DIRECT] API Version utilizada: ${actualApiVersion}`);
    console.log(`[META-DIRECT] BusinessId utilizado: ${actualBusinessId}`);

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