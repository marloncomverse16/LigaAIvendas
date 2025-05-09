/**
 * Módulo para integração com a API do WhatsApp Cloud da Meta
 * Documentação da API: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import axios from "axios";

// Função para obter os templates de mensagem da API da Meta
export async function getMetaApiTemplates(
  whatsappMetaToken: string,
  whatsappMetaBusinessId: string,
  apiVersion: string = "v18.0"
) {
  try {
    if (!whatsappMetaToken || !whatsappMetaBusinessId) {
      console.error("getMetaApiTemplates: Token ou Business ID faltando", { 
        hasToken: !!whatsappMetaToken, 
        hasBusinessId: !!whatsappMetaBusinessId 
      });
      throw new Error("Meta API não configurada corretamente. Token e Business ID são obrigatórios.");
    }

    console.log(`getMetaApiTemplates: Buscando templates via API: ${apiVersion}/${whatsappMetaBusinessId}/message_templates`);
    const endpoint = `https://graph.facebook.com/${apiVersion}/${whatsappMetaBusinessId}/message_templates`;
    
    console.log(`getMetaApiTemplates: Endpoint de templates: ${endpoint}`);
    
    try {
      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${whatsappMetaToken}`,
          "Content-Type": "application/json",
        },
      });
      
      console.log(`getMetaApiTemplates: Resposta da API de templates: status ${response.status}`);
      
      if (response.data && response.data.data) {
        const templates = response.data.data.map((template: any) => ({
          id: template.id,
          name: template.name,
          status: template.status,
          category: template.category,
          language: template.language,
          components: template.components,
        }));
        
        console.log(`getMetaApiTemplates: ${templates.length} templates encontrados`);
        
        return {
          success: true,
          templates
        };
      } else {
        console.log(`getMetaApiTemplates: Nenhum template encontrado na resposta`, response.data);
        return {
          success: true,
          templates: [],
        };
      }
    } catch (axiosError: any) {
      console.error("getMetaApiTemplates: Erro ao fazer requisição:", {
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        data: axiosError.response?.data,
        message: axiosError.message
      });
      
      const errorMessage = axiosError.response?.data?.error?.message || 
                          axiosError.response?.statusText || 
                          axiosError.message || 
                          "Erro desconhecido ao conectar com API da Meta";
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  } catch (error: any) {
    console.error("getMetaApiTemplates: Erro geral:", error);
    return {
      success: false,
      error: error.message || "Erro desconhecido",
    };
  }
}

// Função para enviar mensagem usando a API da Meta
export async function sendMetaApiMessage(
  whatsappMetaToken: string,
  whatsappMetaBusinessId: string,
  phoneNumberId: string,
  templateName: string,
  to: string,
  apiVersion: string = "v18.0",
  language: string = "pt_BR",
  components: any[] = []
) {
  try {
    if (!whatsappMetaToken || !whatsappMetaBusinessId || !phoneNumberId) {
      throw new Error("Meta API não configurada corretamente");
    }

    const endpoint = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    
    const messageData: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
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

    const response = await axios.post(endpoint, messageData, {
      headers: {
        Authorization: `Bearer ${whatsappMetaToken}`,
        "Content-Type": "application/json",
      },
    });

    return {
      success: true,
      messageId: response.data.messages[0].id,
      response: response.data
    };
  } catch (error: any) {
    console.error("Erro ao enviar mensagem pela Meta API:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message
    };
  }
}