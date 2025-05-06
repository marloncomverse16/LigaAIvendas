async getQrCode(): Promise<any> {
  try {
    // Verificamos primeiro se a API está online
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
    // Nossos testes confirmaram que este endpoint funciona com GET:
    // GET /instance/connect/{nome_da_instancia}
    const connectEndpoint = `${this.baseUrl}/instance/connect/${this.instance}`;
    console.log(`Usando exclusivamente o endpoint: ${connectEndpoint}`);
    
    try {
      // Fazer a requisição GET para o endpoint que confirmamos funcionar
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
        }
        
        // Resposta sem QR code reconhecível
        console.log("Resposta não contém QR code reconhecível");
        return {
          success: false,
          error: 'Não foi possível identificar um QR code na resposta da API'
        };
      }
      
      // Status inesperado
      return {
        success: false,
        error: `Resposta com status inesperado: ${response.status}`
      };
    } catch (error) {
      console.error(`Erro ao tentar obter QR code: ${error.message}`);
      
      // Em caso de erro, podemos tentar verificar o estado da conexão
      console.log("Verificando status da conexão como alternativa...");
      try {
        const connectionState = await this.checkConnectionStatus();
        if (connectionState.success && connectionState.connected) {
          return {
            success: true,
            connected: true,
            qrCode: null,
            data: connectionState.data
          };
        }
      } catch (stateError) {
        console.log(`Erro ao verificar estado da conexão: ${stateError.message}`);
      }
      
      return {
        success: false,
        error: `Falha ao obter QR code: ${error.message}`
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