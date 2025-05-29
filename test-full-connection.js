/**
 * Teste completo do fluxo de conexão - simular exatamente o que nossa aplicação faz
 */

import axios from 'axios';

const BASE_URL = 'https://api.primerastreadores.com';
const API_TOKEN = '0f9e7d76866fd738dbed11acfcef1403';
const INSTANCE_NAME = 'admin'; // Nome do usuário

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': API_TOKEN
  };
}

async function testFullConnectionFlow() {
  console.log('🧪 TESTE COMPLETO DO FLUXO DE CONEXÃO');
  console.log('====================================');
  
  try {
    // PASSO 1: Verificar API
    console.log('\n🔍 PASSO 1: Verificando status da API...');
    const apiResponse = await axios.get(BASE_URL, {
      headers: getHeaders()
    });
    console.log('✅ API funcionando:', apiResponse.data.version);
    
    // PASSO 2: Listar instâncias existentes
    console.log('\n🔍 PASSO 2: Listando instâncias existentes...');
    const instancesResponse = await axios.get(`${BASE_URL}/instance/fetchInstances`, {
      headers: getHeaders()
    });
    
    console.log(`📋 ${instancesResponse.data.length} instâncias encontradas:`);
    instancesResponse.data.forEach((instance, i) => {
      console.log(`  ${i+1}. ${instance.name} - Status: ${instance.connectionStatus}`);
    });
    
    // Verificar se já existe uma instância com o nome do usuário
    const existingInstance = instancesResponse.data.find(inst => inst.name === INSTANCE_NAME);
    
    if (existingInstance) {
      console.log(`\n⚠️  PASSO 3: Instância "${INSTANCE_NAME}" já existe - deletando...`);
      try {
        await axios.delete(`${BASE_URL}/instance/delete/${INSTANCE_NAME}`, {
          headers: getHeaders()
        });
        console.log('✅ Instância deletada com sucesso');
        
        // Aguardar um pouco para a deleção se completar
        console.log('⏳ Aguardando deleção...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (deleteError) {
        console.log('⚠️  Erro ao deletar instância (pode não ser crítico):', deleteError.message);
      }
    }
    
    // PASSO 4: Criar nova instância
    console.log(`\n🔧 PASSO 4: Criando nova instância "${INSTANCE_NAME}"...`);
    const createResponse = await axios.post(`${BASE_URL}/instance/create`, {
      instanceName: INSTANCE_NAME,
      integration: "WHATSAPP-BAILEYS"
    }, {
      headers: getHeaders()
    });
    
    console.log('✅ Instância criada:', createResponse.data);
    
    // PASSO 5: Aguardar um momento e obter QR Code
    console.log('\n⏳ PASSO 5: Aguardando e obtendo QR Code...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const qrResponse = await axios.get(`${BASE_URL}/instance/connect/${INSTANCE_NAME}`, {
      headers: getHeaders()
    });
    
    if (qrResponse.data && typeof qrResponse.data === 'string' && qrResponse.data.startsWith('data:image/png;base64,')) {
      console.log('🎉 QR CODE OBTIDO COM SUCESSO!');
      console.log(`📄 Tamanho do QR Code: ${qrResponse.data.length} caracteres`);
      console.log(`🔗 Primeira parte: ${qrResponse.data.substring(0, 50)}...`);
      return {
        success: true,
        qrCode: qrResponse.data,
        instance: INSTANCE_NAME
      };
    } else {
      console.log('❌ QR Code não encontrado na resposta');
      console.log('📋 Resposta recebida:', JSON.stringify(qrResponse.data).substring(0, 200));
      return {
        success: false,
        error: 'QR Code não encontrado'
      };
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    if (error.response) {
      console.error('📋 Status:', error.response.status);
      console.error('📋 Dados:', JSON.stringify(error.response.data).substring(0, 200));
    }
    return {
      success: false,
      error: error.message
    };
  }
}

// Executar o teste
testFullConnectionFlow().then(result => {
  console.log('\n🏁 RESULTADO FINAL:');
  console.log('===================');
  if (result.success) {
    console.log('✅ SUCESSO: QR Code gerado com sucesso!');
  } else {
    console.log('❌ FALHA:', result.error);
  }
}).catch(console.error);