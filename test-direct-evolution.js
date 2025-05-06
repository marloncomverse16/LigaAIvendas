import axios from 'axios';

// Estas são configurações que você pode alterar
const apiUrl = 'https://api.primerastreadores.com';
const token = '4db623449606bcf2814521b73657dbc0'; // Token que sabemos que funciona
const instance = 'admin';

// Primeira etapa: vamos verificar se a API está acessível
async function checkApiStatus(token) {
  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    const response = await axios.get(apiUrl, { headers });
    
    if (response.status === 200) {
      console.log('✅ API Acessível:', response.data);
      return {
        success: true,
        data: response.data
      };
    } else {
      console.log('❌ API retornou status inesperado:', response.status);
      return {
        success: false,
        status: response.status
      };
    }
  } catch (error) {
    console.log('❌ Erro ao acessar API:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Segunda etapa: vamos tentar criar a instância
async function createInstance(token) {
  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    const payload = {
      instanceName: instance,
      token: "LigAi01", // Verificar se este token realmente é necessário
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      webhook_base64: true,
      webhook: null,
      webhookByEvents: false,
      reject_call: false,
      events_message: false, 
      ignore_group: true,
      ignore_broadcast: true
    };
    
    console.log('Tentando criar instância com payload:', payload);
    
    const response = await axios.post(`${apiUrl}/create`, payload, { headers });
    
    if (response.status === 200 || response.status === 201) {
      console.log('✅ Instância criada com sucesso:', response.data);
      return {
        success: true,
        data: response.data
      };
    } else {
      console.log('❌ Criação de instância retornou status inesperado:', response.status);
      return {
        success: false,
        status: response.status
      };
    }
  } catch (error) {
    console.log('❌ Erro ao criar instância:', error.message);
    if (error.response) {
      console.log('Detalhes da resposta:', error.response.data);
    }
    return {
      success: false,
      error: error.message
    };
  }
}

// Terceira etapa: vamos obter o QR code
async function getQrCode(token) {
  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Teste cada um desses endpoints, um deles deve funcionar
    const endpoints = [
      `${apiUrl}/generate-qrcode`,
      `${apiUrl}/api/qrcode/${instance}`,
      `${apiUrl}/api/sessions/qrcode/${instance}`,
      `${apiUrl}/v1/qrcode/${instance}`,
      `${apiUrl}/v1/instance/qrcode/${instance}`,
      `${apiUrl}/v1/instance/qr/${instance}`,
      `${apiUrl}/instances/${instance}/qrcode`,
      `${apiUrl}/instances/${instance}/qr`,
      `${apiUrl}/manager/instances/${instance}/qrcode`
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Tentando obter QR code de: ${endpoint}`);
        
        const response = await axios.get(endpoint, { headers });
        
        if (response.status === 200) {
          console.log(`✅ Sucesso em ${endpoint}`);
          
          // Verificar se a resposta é string HTML
          if (typeof response.data === 'string' && 
              (response.data.includes('<!DOCTYPE') || 
               response.data.includes('<html'))) {
            console.log('❌ Resposta é HTML, não um QR code');
            continue;
          }
          
          // Verificar se a resposta contém um QR code
          if (response.data) {
            const qrCode = response.data.qrcode || 
                           response.data.qrCode || 
                           response.data.base64 || 
                           response.data.code || 
                           response.data.data?.qrcode ||
                           response.data.data?.qrCode;
                           
            if (qrCode) {
              console.log('✅ QR CODE ENCONTRADO!');
              return {
                success: true,
                endpoint: endpoint,
                qrCode: qrCode.substring(0, 50) + '...' // Mostrar apenas uma parte
              };
            }
          }
          
          console.log('Resposta obtida, mas não contém QR code:', response.data);
        }
      } catch (endpointError) {
        console.log(`❌ Erro em ${endpoint}: ${endpointError.message}`);
      }
    }
    
    console.log('❌ Nenhum endpoint retornou QR code');
    return {
      success: false,
      error: 'Nenhum endpoint retornou QR code'
    };
  } catch (error) {
    console.log('❌ Erro geral ao obter QR code:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Função principal para testar todos os tokens
async function testAllTokens() {
  // Lista de tokens para testar
  const tokens = [
    "4db623449606bcf2814521b73657dbc0",  // Token principal
    "LigAi01",                           // Token alternativo
    process.env.EVOLUTION_API_TOKEN || "" // Token do ambiente (se existir)
  ];
  
  console.log(`Testando ${tokens.length} tokens diferentes...`);
  
  for (const currentToken of tokens) {
    if (!currentToken) continue;
    
    console.log(`\n=======================================`);
    console.log(`Testando token: ${currentToken.substring(0, 4)}...${currentToken.substring(currentToken.length - 4)}`);
    console.log(`=======================================\n`);
    
    // 1. Verificar API
    const apiStatus = await checkApiStatus(currentToken);
    if (!apiStatus.success) {
      console.log(`Token ${currentToken} falhou no acesso básico à API.`);
      continue;
    }
    
    // 2. Criar instância
    const createResult = await createInstance(currentToken);
    // Mesmo se falhar, continuar para o QR code já que a instância pode já existir
    
    // 3. Obter QR code
    const qrResult = await getQrCode(currentToken);
    
    if (qrResult.success) {
      console.log(`\n🔵🔵🔵 SUCESSO! Token ${currentToken} conseguiu obter QR code 🔵🔵🔵`);
      console.log(`Endpoint: ${qrResult.endpoint}`);
      console.log(`QR Code (primeiros caracteres): ${qrResult.qrCode}`);
      
      // Se encontrou, não precisa testar mais tokens
      return;
    }
  }
  
  console.log('\n❌ Todos os tokens falharam em obter QR code.');
}

// Executar os testes
testAllTokens().catch(error => {
  console.error('Erro ao executar testes:', error);
});