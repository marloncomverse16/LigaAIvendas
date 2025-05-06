/**
 * Implementação simplificada do getQrCode para substituir o método existente
 */

async getQrCode(): Promise<any> {
  try {
    // Verificar se a API está online primeiro
    const apiStatus = await this.checkApiStatus();
    if (!apiStatus.online) {
      return {
        success: false,
        error: 'API Evolution indisponível',
        details: apiStatus
      };
    }

    console.log("API Evolution online. Tentando obter QR code diretamente...");
    
    // MODO SIMPLIFICADO: Usar apenas o endpoint que sabemos que funciona
    const connectEndpoint = `${this.baseUrl}/instance/connect/${this.instance}`;
    console.log(`Usando especificamente o endpoint: ${connectEndpoint}`);
    
    try {
      // Fazer a requisição GET para o endpoint funcionando
      const response = await axios.get(connectEndpoint, {
        headers: this.getHeaders(),
        timeout: 10000 // Timeout adequado de 10 segundos
      });
      
      console.log(`Resposta do endpoint: Status ${response.status}`);
      
      if (response.status === 200 || response.status === 201) {
        // Verificar se a resposta contém HTML (erro comum)
        const responseStr = typeof response.data === 'string' 
          ? response.data 
          : JSON.stringify(response.data);
          
        if (responseStr.includes('<!DOCTYPE html>') || 
            responseStr.includes('<html') || 
            responseStr.includes('<body')) {
          console.log("Resposta contém HTML, isso indica um erro de autenticação ou permissão");
          return {
            success: false,
            error: 'A API Evolution está retornando HTML em vez de um QR code válido. Verifique as credenciais e permissões.'
          };
        }
        
        // Extrair o QR code da resposta (como string ou em um campo específico)
        const qrCode = response.data?.qrcode || 
                      response.data?.qrCode || 
                      response.data?.base64 || 
                      response.data?.code ||
                      (typeof response.data === 'string' ? response.data : null);
        
        if (qrCode) {
          console.log("QR Code obtido com sucesso!");
          return {
            success: true,
            qrCode: qrCode,
            endpoint: connectEndpoint,
            method: 'GET'
          };
        } else if (response.data?.state === 'open' || 
                  response.data?.state === 'connected' ||
                  response.data?.connected === true) {
          // Já está conectado
          console.log("Instância já está conectada!");
          return {
            success: true,
            connected: true,
            qrCode: null,
            data: response.data
          };
        } else {
          console.log("Resposta não contém QR code reconhecível");
          console.log("Conteúdo da resposta:", 
            typeof response.data === 'string' 
              ? response.data.substring(0, 100) 
              : JSON.stringify(response.data, null, 2).substring(0, 100));
          
          return {
            success: false,
            error: 'Não foi possível identificar um QR code na resposta da API'
          };
        }
      } else {
        console.log(`Status inesperado: ${response.status}`);
        return {
          success: false,
          error: `Resposta com status inesperado: ${response.status}`
        };
      }
    } catch (error) {
      console.error(`Erro ao tentar obter QR code: ${error.message}`);
      
      // Se o erro for 401 ou 403, provavelmente é um problema de autenticação
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        return {
          success: false,
          error: 'Erro de autenticação. Verifique o token da API Evolution.'
        };
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  } catch (error) {
    console.error("Erro geral ao obter QR code:", error);
    return {
      success: false,
      error: error.message
    };
  }
}