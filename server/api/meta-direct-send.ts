/**
 * Módulo para envio direto de mensagens via Meta API
 * Esta implementação simplificada evita problemas com autenticação e middleware
 */
import { Request, Response } from "express";
import axios from "axios";
import { pool } from "../db";

// Interfaces para mensagens da Meta API
interface MetaTemplateLanguage {
  code: string;
}

interface MetaTemplate {
  name: string;
  language: MetaTemplateLanguage;
  components?: any[];
}

interface MetaMessageData {
  messaging_product: string;
  recipient_type: string;
  to: string;
  type: string;
  template: MetaTemplate;
}

/**
 * Endpoint para enviar mensagens diretamente via Meta API
 * Útil para testing e diagnóstico
 */
export async function sendMetaMessageDirectly(req: Request, res: Response) {
  console.log("[META-DIRECT-SEND] Iniciando envio direto de mensagem");
  
  // Declarar variáveis no escopo mais externo para uso no bloco de catch
  let token = '';
  let businessId = '';
  let apiVersion = 'v18.0';
  let phoneNumberId = '';
  
  try {
    // Buscar o primeiro usuário com token Meta configurado
    // As configurações estão na tabela 'settings', não na tabela 'users'
    const result = await pool.query(`
      SELECT 
        settings.user_id, 
        settings.whatsapp_meta_token, 
        settings.whatsapp_meta_business_id, 
        settings.whatsapp_meta_api_version,
        settings.whatsapp_meta_phone_number_id
      FROM settings
      WHERE 
        settings.whatsapp_meta_token IS NOT NULL AND 
        settings.whatsapp_meta_token != '' AND
        settings.whatsapp_meta_business_id IS NOT NULL AND
        settings.whatsapp_meta_business_id != ''
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log("[META-DIRECT-SEND] Nenhum usuário com configuração Meta encontrado");
      return res.status(404).json({ 
        error: "Nenhum usuário com configuração Meta encontrado",
        success: false
      });
    }

    // Verificar os dados necessários para o envio da mensagem
    if (!req.body.to || !req.body.templateName) {
      return res.status(400).json({
        error: "Parâmetros incompletos. 'to' (número de telefone) e 'templateName' são obrigatórios.",
        success: false
      });
    }

    const user = result.rows[0];
    // Atualizar as variáveis declaradas no escopo externo
    token = user.whatsapp_meta_token;
    businessId = user.whatsapp_meta_business_id;
    apiVersion = user.whatsapp_meta_api_version || "v18.0";  // Default to v18.0 if not set
    phoneNumberId = user.whatsapp_meta_phone_number_id || "";
    
    // Variáveis que serão potencialmente modificadas durante a detecção de problemas
    let actualToken = token;
    let actualBusinessId = businessId;
    let actualApiVersion = apiVersion;
    let actualPhoneNumberId = phoneNumberId;
    let valuesSwapped = false;
    
    // Verificando se os valores parecem estar em ordem
    if (token.length < 20) {
      console.log("[META-DIRECT-SEND] ALERTA: Token parece muito curto, apenas", token.length, "caracteres");
    }
    
    // Logging das informações para debug
    console.log("[META-DIRECT-SEND] Token length:", token.length);
    console.log("[META-DIRECT-SEND] BusinessId length:", businessId.length);
    console.log("[META-DIRECT-SEND] API Version value:", apiVersion);
    console.log("[META-DIRECT-SEND] PhoneNumberId value:", phoneNumberId);
    
    // Verificar formato do businessId (deve ser numérico)
    const businessIdIsNumeric = !isNaN(Number(businessId));
    const tokenIsNumeric = !isNaN(Number(token));
    
    // Verificar se o apiVersion pode estar no lugar errado (outro erro comum)
    const apiVersionMisplaced = apiVersion.startsWith("EAA") || apiVersion.length > 50;
    
    // Testes para detectar inversão de token/businessId
    const businessIdLooksLikeToken = businessId.length > 50 || businessId.includes("EAA");
    const tokenLooksLikeBusinessId = token.length < 30 && tokenIsNumeric;
    const apiVersionLooksLikeBusinessId = !apiVersionMisplaced && apiVersion.length < 30 && !isNaN(Number(apiVersion));
    
    console.log("[META-DIRECT-SEND] Diagnóstico: businessIdIsNumeric:", businessIdIsNumeric);
    console.log("[META-DIRECT-SEND] Diagnóstico: tokenIsNumeric:", tokenIsNumeric);
    console.log("[META-DIRECT-SEND] Diagnóstico: businessIdLooksLikeToken:", businessIdLooksLikeToken);
    console.log("[META-DIRECT-SEND] Diagnóstico: tokenLooksLikeBusinessId:", tokenLooksLikeBusinessId);
    console.log("[META-DIRECT-SEND] Diagnóstico: apiVersionMisplaced:", apiVersionMisplaced);
    
    // Caso 1: BusinessId e Token estão invertidos
    if ((businessIdLooksLikeToken && tokenLooksLikeBusinessId) || 
        (businessId.length > 50 && token.length < 30 && tokenIsNumeric)) {
      console.log("[META-DIRECT-SEND] ALERTA: BusinessId e Token parecem estar invertidos.");
      actualToken = businessId;
      actualBusinessId = token;
      valuesSwapped = true;
      console.log("[META-DIRECT-SEND] Valores invertidos: BusinessId e Token trocados.");
    } 
    // Caso 2: API Version contém o token
    else if (apiVersionMisplaced) {
      console.log("[META-DIRECT-SEND] ALERTA: API Version parece conter um token de acesso.");
      actualToken = apiVersion;
      actualApiVersion = "v18.0"; // Usar valor padrão para API
      console.log("[META-DIRECT-SEND] Usando API Version padrão (v18.0) e movendo o valor original para token.");
    } 
    // Caso 3: BusinessId não é numérico
    else if (!businessIdIsNumeric && !valuesSwapped) {
      console.log("[META-DIRECT-SEND] ALERTA: BusinessId não é numérico:", businessId);
      
      // Se o token parece ser numérico, pode ser outro caso de inversão
      if (tokenIsNumeric && token.length < 30) {
        console.log("[META-DIRECT-SEND] ALERTA: Token parece ser um businessId válido. Invertendo...");
        actualToken = businessId;
        actualBusinessId = token;
        valuesSwapped = true;
      }
      // Se API version parece ser um businessId, também verificar
      else if (apiVersionLooksLikeBusinessId) {
        console.log("[META-DIRECT-SEND] ALERTA: API Version parece ser um businessId válido. Ajustando...");
        actualBusinessId = apiVersion;
        actualApiVersion = "v18.0";
      }
    }

    // Se phoneNumberId estiver vazio, tentar usar o businessId como fallback
    if (!actualPhoneNumberId || actualPhoneNumberId.trim() === '') {
      console.log("[META-DIRECT-SEND] ALERTA: PhoneNumberId está vazio, tentando usar BusinessId como fallback");
      actualPhoneNumberId = actualBusinessId;
    }

    console.log(`[META-DIRECT-SEND] Usando usuário ID ${user.user_id} para enviar mensagem`);
    console.log(`[META-DIRECT-SEND] BusinessID: ${businessId}`);
    console.log(`[META-DIRECT-SEND] API Version: ${apiVersion}`);
    console.log(`[META-DIRECT-SEND] PhoneNumberId: ${phoneNumberId}`);
    console.log(`[META-DIRECT-SEND] Token (primeiros 10 chars): ${token.substring(0, 10)}...`);

    // Extrair parâmetros da requisição
    const { to, templateName, language = "pt_BR", components = [] } = req.body;

    // Formatar número de telefone (remover '+' se presente)
    const formattedTo = to.startsWith('+') ? to.substring(1) : to;

    // URL para enviar mensagem
    const url = `https://graph.facebook.com/${actualApiVersion}/${actualPhoneNumberId}/messages`;

    console.log(`[META-DIRECT-SEND] URL final: ${url}`);
    console.log(`[META-DIRECT-SEND] Token utilizado (primeiros 10 chars): ${actualToken.substring(0, 10)}...`);
    console.log(`[META-DIRECT-SEND] API Version utilizada: ${actualApiVersion}`);
    console.log(`[META-DIRECT-SEND] PhoneNumberId utilizado: ${actualPhoneNumberId}`);
    console.log(`[META-DIRECT-SEND] Telefone de destino: ${formattedTo}`);
    console.log(`[META-DIRECT-SEND] Nome do template: ${templateName}`);

    // Preparar dados para envio
    const messageData: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formattedTo,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: language
        }
      }
    };

    // Adicionar componentes se fornecidos
    if (components && components.length > 0) {
      messageData.template.components = components;
    }

    console.log(`[META-DIRECT-SEND] Dados da mensagem:`, JSON.stringify(messageData, null, 2));

    // Enviar mensagem para a Meta API
    const response = await axios.post(url, messageData, {
      headers: {
        Authorization: `Bearer ${actualToken}`,
        "Content-Type": "application/json",
      }
    });

    console.log(`[META-DIRECT-SEND] Resposta da API:`, response.data);

    return res.status(200).json({
      success: true,
      messageId: response.data.messages[0].id,
      response: response.data
    });
  } catch (error: any) {
    console.error("[META-DIRECT-SEND] Erro ao enviar mensagem:", error.message);
    
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
      
      console.log("[META-DIRECT-SEND] Erro específico da Meta API:", {
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
      } else if (errorCodeStr === "130429") {
        // Rate limit
        suggestedFix = "Limite de requisições atingido. Aguarde alguns minutos e tente novamente.";
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
          phoneNumberId: phoneNumberId,
          tokenFormat: token.substring(0, 3) + "..." 
        }
      : { 
          message: error.message,
          suggestedFix,
          code: error.code || 'UNKNOWN'
        };
    
    return res.status(500).json({
      error: "Erro ao enviar mensagem",
      details: errorDetails,
      success: false
    });
  }
}