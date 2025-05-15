import axios from "axios";

/**
 * Interface para envio de mensagens via Meta API
 */
export interface MetaMessageRequest {
  to: string;
  templateName: string;
  templateId: string;
  language: string;
  components?: Array<{
    type: string;
    parameters: Array<{
      type: string;
      text?: string;
      image?: {
        link: string;
      };
      document?: {
        link: string;
      };
    }>;
  }>;
}

/**
 * Resultados da API da Meta
 */
export interface MetaApiResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Obtém a lista de templates aprovados da API da Meta
 * @param token Token de acesso à API da Meta
 * @param businessId ID do negócio na Meta
 * @param apiVersion Versão da API (default: v18.0)
 */
export async function getMetaApiTemplates(
  token: string,
  businessId: string,
  apiVersion: string = "v18.0"
): Promise<MetaApiResult> {
  try {
    const url = `https://graph.facebook.com/${apiVersion}/${businessId}/message_templates`;
    
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      params: {
        limit: 100,
      },
    });
    
    if (response.data && response.data.data) {
      return {
        success: true,
        data: response.data.data.filter((template: any) => 
          template.status === "APPROVED"
        ),
      };
    }
    
    return {
      success: false,
      error: "Formato de resposta inesperado",
      data: response.data,
    };
  } catch (error: any) {
    console.error("Erro ao obter templates da Meta API:", error);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message || "Erro desconhecido",
    };
  }
}

/**
 * Envia uma mensagem via API da Meta usando um template
 * @param params Parâmetros para envio da mensagem
 * @param token Token de acesso à API da Meta
 * @param phoneNumberId ID do número de telefone na Meta
 * @param apiVersion Versão da API (default: v18.0)
 */
export async function sendMetaApiMessage(
  params: MetaMessageRequest,
  token: string,
  phoneNumberId: string,
  apiVersion: string = "v18.0"
): Promise<MetaApiResult> {
  try {
    // Formatar número conforme exigido pela Meta
    let formattedPhone = params.to.replace(/\\D/g, "");
    
    // Garantir que tem código do país (Meta exige isso)
    if (!formattedPhone.startsWith("55")) {
      formattedPhone = "55" + formattedPhone;
    }
    
    // Remover o 9 extra se o número tiver mais de 12 dígitos
    if (formattedPhone.length > 12) {
      // Remover o nono dígito (normalmente o 9 após o DDD)
      formattedPhone = formattedPhone.substring(0, 4) + formattedPhone.substring(5);
    }
    
    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    
    const messageData = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formattedPhone,
      type: "template",
      template: {
        name: params.templateName,
        language: {
          code: params.language || "pt_BR",
        },
        components: params.components || [],
      },
    };
    
    console.log(`Enviando mensagem para ${formattedPhone} usando template ${params.templateName}`);
    
    const response = await axios.post(url, messageData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    
    if (response.data && response.data.messages && response.data.messages.length > 0) {
      return {
        success: true,
        data: response.data,
      };
    }
    
    return {
      success: false,
      error: "Formato de resposta inesperado",
      data: response.data,
    };
  } catch (error: any) {
    console.error("Erro ao enviar mensagem via Meta API:", error);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message || "Erro desconhecido",
    };
  }
}