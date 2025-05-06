#!/bin/bash

# Este script irá substituir o método getQrCode no arquivo evolution-api.ts por uma implementação simplificada

# Primeiro, vamos encontrar o início e o fim do método
START_LINE=$(grep -n "async getQrCode()" server/evolution-api.ts | cut -d: -f1)
END_LINE=$(grep -n -A 5000 "async getQrCode()" server/evolution-api.ts | grep -n "^\s*}" | head -1 | cut -d: -f1)
END_LINE=$((START_LINE + END_LINE - 1))

echo "Método getQrCode encontrado entre as linhas $START_LINE e $END_LINE"

# Agora vamos remover o método atual e inserir o novo
sed -i "${START_LINE},${END_LINE}d" server/evolution-api.ts

# Inserir o novo método
sed -i "${START_LINE}i\\
  async getQrCode(): Promise<any> {\n\
    try {\n\
      // Verificamos primeiro se a API está online\n\
      const apiStatus = await this.checkApiStatus();\n\
      if (!apiStatus.online) {\n\
        return {\n\
          success: false,\n\
          error: 'API Evolution indisponível',\n\
          details: apiStatus\n\
        };\n\
      }\n\
\n\
      console.log(\"API Evolution online. Tentando obter QR code diretamente...\");\n\
      \n\
      // MODO SIMPLIFICADO: Usar apenas o endpoint que sabemos que funciona\n\
      // Nossos testes confirmaram que este endpoint funciona com GET:\n\
      // GET /instance/connect/{nome_da_instancia}\n\
      const connectEndpoint = \`\${this.baseUrl}/instance/connect/\${this.instance}\`;\n\
      console.log(\`Usando exclusivamente o endpoint: \${connectEndpoint}\`);\n\
      \n\
      try {\n\
        // Fazer a requisição GET para o endpoint que confirmamos funcionar\n\
        const response = await axios.get(connectEndpoint, {\n\
          headers: this.getHeaders(),\n\
          timeout: 10000 // Timeout adequado de 10 segundos\n\
        });\n\
        \n\
        console.log(\`Resposta do endpoint: Status \${response.status}\`);\n\
        \n\
        if (response.status === 200 || response.status === 201) {\n\
          // Verificar se a resposta contém HTML (erro comum)\n\
          const responseStr = typeof response.data === 'string' \n\
            ? response.data \n\
            : JSON.stringify(response.data);\n\
            \n\
          if (responseStr.includes('<!DOCTYPE html>') || \n\
              responseStr.includes('<html') || \n\
              responseStr.includes('<body')) {\n\
            console.log(\"Resposta contém HTML, isso indica um erro de autenticação ou permissão\");\n\
            return {\n\
              success: false,\n\
              error: 'A API Evolution está retornando HTML em vez de um QR code válido. Verifique as credenciais e permissões.'\n\
            };\n\
          }\n\
          \n\
          // Extrair o QR code da resposta (como string ou em um campo específico)\n\
          const qrCode = response.data?.qrcode || \n\
                        response.data?.qrCode || \n\
                        response.data?.base64 || \n\
                        response.data?.code ||\n\
                        (typeof response.data === 'string' ? response.data : null);\n\
          \n\
          if (qrCode) {\n\
            console.log(\"QR Code obtido com sucesso!\");\n\
            return {\n\
              success: true,\n\
              qrCode: qrCode,\n\
              endpoint: connectEndpoint,\n\
              method: 'GET'\n\
            };\n\
          } else if (response.data?.state === 'open' || \n\
                    response.data?.state === 'connected' ||\n\
                    response.data?.connected === true) {\n\
            // Já está conectado\n\
            console.log(\"Instância já está conectada!\");\n\
            return {\n\
              success: true,\n\
              connected: true,\n\
              qrCode: null,\n\
              data: response.data\n\
            };\n\
          }\n\
          \n\
          // Resposta sem QR code reconhecível\n\
          console.log(\"Resposta não contém QR code reconhecível\");\n\
          return {\n\
            success: false,\n\
            error: 'Não foi possível identificar um QR code na resposta da API'\n\
          };\n\
        }\n\
        \n\
        // Status inesperado\n\
        return {\n\
          success: false,\n\
          error: \`Resposta com status inesperado: \${response.status}\`\n\
        };\n\
      } catch (error) {\n\
        console.error(\`Erro ao tentar obter QR code: \${error.message}\`);\n\
        \n\
        // Em caso de erro, podemos tentar verificar o estado da conexão\n\
        console.log(\"Verificando status da conexão como alternativa...\");\n\
        try {\n\
          const connectionState = await this.checkConnectionStatus();\n\
          if (connectionState.success && connectionState.connected) {\n\
            return {\n\
              success: true,\n\
              connected: true,\n\
              qrCode: null,\n\
              data: connectionState.data\n\
            };\n\
          }\n\
        } catch (stateError) {\n\
          console.log(\`Erro ao verificar estado da conexão: \${stateError.message}\`);\n\
        }\n\
        \n\
        return {\n\
          success: false,\n\
          error: \`Falha ao obter QR code: \${error.message}\`\n\
        };\n\
      }\n\
    } catch (error) {\n\
      console.error(\"Erro geral ao obter QR code:\", error);\n\
      return {\n\
        success: false,\n\
        error: error.message\n\
      };\n\
    }\n\
  }" server/evolution-api.ts

echo "Método getQrCode substituído com sucesso!"