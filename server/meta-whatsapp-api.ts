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
      throw new Error("Meta API não configurada corretamente. Token e Business ID são obrigatórios.");
    }

    console.log(`Buscando templates via API: ${apiVersion}/${whatsappMetaBusinessId}/message_templates`);
    const endpoint = `https://graph.facebook.com/${apiVersion}/${whatsappMetaBusinessId}/message_templates`;
    
    console.log(`Endpoint de templates: ${endpoint}`);
    console.log(`Token válido (primeiro 5 caracteres): ${whatsappMetaToken.substring(0, 5)}...`);
    console.log(`Business ID: ${whatsappMetaBusinessId}`);
    
    const headers = {
      Authorization: `Bearer ${whatsappMetaToken}`,
      "Content-Type": "application/json",
    };
    
    console.log("Headers da requisição:", JSON.stringify(headers));
    
    const response = await axios.get(endpoint, { headers });
    
    console.log(`Resposta da API de templates: status ${response.status}`);
    console.log('Headers:', JSON.stringify(response.headers));
    console.log('Dados:', JSON.stringify(response.data));

    if (response.data && response.data.data) {
      console.log(`Templates brutos encontrados: ${response.data.data.length}`);
      
      try {
        // Exibir informações sobre cada template para debugging
        response.data.data.forEach((template: any, index: number) => {
          console.log(`Template #${index+1}:`);
          console.log(`  ID: ${template.id || 'não definido'}`);
          console.log(`  Nome: ${template.name || 'não definido'}`);
          console.log(`  Status: ${template.status || 'não definido'}`);
          console.log(`  Categoria: ${template.category || 'não definida'}`);
          console.log(`  Idioma: ${template.language || 'não definido'}`);
          console.log(`  Componentes: ${template.components ? JSON.stringify(template.components) : 'não definidos'}`);
        });
      
        // Processar os templates para garantir que todos os campos necessários existam
        const processedTemplates = response.data.data.map((template: any) => ({
          id: template.id || `template_${Math.random().toString(36).substring(2, 11)}`,
          name: template.name || "Template sem nome",
          status: template.status || "UNKNOWN",
          category: template.category || "UTILITY",
          language: template.language || "pt_BR",
          components: template.components || [],
          // Campos adicionais que podem ser úteis
          createdTime: template.created_time,
          modifiedTime: template.modified_time,
        }));
        
        console.log(`Processados ${processedTemplates.length} templates`);
        
        return {
          success: true,
          templates: processedTemplates,
        };
      } catch (processingError) {
        console.error("Erro ao processar templates:", processingError);
        return {
          success: false,
          error: `Erro ao processar templates: ${processingError.message}`,
          rawData: response.data
        };
      }
    } else {
      console.log("Resposta da API não contém templates no formato esperado");
      console.log("Dados completos:", JSON.stringify(response.data));
      
      return {
        success: false,
        error: "Nenhum template encontrado na API da Meta",
        rawData: response.data,
      };
    }
  } catch (error: any) {
    console.error("Erro ao buscar templates da Meta API:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
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