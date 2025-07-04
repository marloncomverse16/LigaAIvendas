/**
 * Teste do processo completo de geração de instância seguindo os 4 passos:
 * 1. Verificar se instância já existe
 * 2. Excluir instância (se existir)
 * 3. Criar nova instância com o nome do usuário
 * 4. Gerar QR code
 */

import axios from 'axios';
import pg from 'pg';
const { Pool } = pg;

// Configuração do banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testInstanceGeneration() {
  console.log('🧪 Testando processo completo de geração de instância...\n');

  try {
    // Buscar dados do usuário e servidor
    const userQuery = `
      SELECT 
        u.id, u.username, u.name,
        s.api_url, s.api_token
      FROM users u
      LEFT JOIN user_servers us ON u.id = us.user_id
      LEFT JOIN servers s ON us.server_id = s.id
      WHERE u.id = 2 AND s.active = true
      LIMIT 1
    `;

    const result = await pool.query(userQuery);
    if (result.rows.length === 0) {
      console.log('❌ Usuário ou servidor não encontrado');
      return;
    }

    const userData = result.rows[0];
    console.log('📋 Dados encontrados:');
    console.log(`   - Usuário: ${userData.name} (${userData.username})`);
    console.log(`   - API URL: ${userData.api_url}`);
    console.log(`   - Token: ${userData.api_token?.substring(0, 5)}...${userData.api_token?.substring(userData.api_token.length - 4)}\n`);

    const headers = {
      'apikey': userData.api_token,
      'Content-Type': 'application/json'
    };

    const instanceName = userData.username;

    // PASSO 1: Verificar se instância já existe
    console.log('🔍 PASSO 1: Verificando se instância já existe...');
    try {
      const listResponse = await axios.get(`${userData.api_url}/instance/fetchInstances`, { headers });
      const instances = listResponse.data;
      console.log(`📋 Total de instâncias: ${instances.length}`);
      
      // Listar nomes das instâncias para debug
      const instanceNames = instances.map(inst => inst.name);
      console.log(`📋 Nomes das instâncias: ${instanceNames.join(', ')}`);
      
      // Verificar se existe uma instância com o nome correto
      const instanceExists = instances.some(instance => instance.name === instanceName);
      console.log(`   - Instância "${instanceName}" ${instanceExists ? 'EXISTE' : 'NÃO EXISTE'}\n`);

      // PASSO 2: Excluir instância se existir
      if (instanceExists) {
        console.log('🗑️ PASSO 2: Excluindo instância existente...');
        try {
          const deleteResponse = await axios.delete(`${userData.api_url}/instance/delete/${instanceName}`, { headers });
          console.log(`✅ Instância "${instanceName}" excluída com sucesso`);
          console.log(`📋 Resposta: ${JSON.stringify(deleteResponse.data)}\n`);
          
          // Aguardar para a exclusão processar
          console.log('⏳ Aguardando 3 segundos para a exclusão processar...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (deleteError) {
          console.log(`❌ Erro ao excluir instância: ${deleteError.message}`);
          console.log(`📋 Detalhes: ${deleteError.response?.data ? JSON.stringify(deleteError.response.data) : 'Sem detalhes'}\n`);
        }
      } else {
        console.log('ℹ️ PASSO 2: Pular exclusão (instância não existe)\n');
      }

      // PASSO 3: Criar nova instância
      console.log('🆕 PASSO 3: Criando nova instância...');
      const createPayload = {
        instanceName: instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
      };

      try {
        const createResponse = await axios.post(`${userData.api_url}/instance/create`, createPayload, { headers });
        console.log(`✅ Instância "${instanceName}" criada com sucesso`);
        console.log(`📋 Status: ${createResponse.status}`);
        console.log(`📋 Resposta: ${JSON.stringify(createResponse.data)}\n`);
        
        // Aguardar para a instância inicializar
        console.log('⏳ Aguardando 5 segundos para a instância inicializar...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (createError) {
        console.log(`❌ Erro ao criar instância: ${createError.message}`);
        console.log(`📋 Status: ${createError.response?.status}`);
        console.log(`📋 Detalhes: ${createError.response?.data ? JSON.stringify(createError.response.data) : 'Sem detalhes'}\n`);
        // Continuar mesmo com erro na criação
      }

      // PASSO 4: Gerar QR code
      console.log('📱 PASSO 4: Gerando QR code...');
      const qrEndpoints = [
        `${userData.api_url}/instance/connect/${instanceName}`,
        `${userData.api_url}/instance/qrcode/${instanceName}`,
        `${userData.api_url}/qrcode/${instanceName}`
      ];

      let qrCodeObtained = false;
      
      for (const endpoint of qrEndpoints) {
        if (qrCodeObtained) break;

        console.log(`🔄 Tentando endpoint: ${endpoint}`);
        
        // Tentar POST primeiro
        try {
          const qrResponse = await axios.post(endpoint, { instanceName }, { headers });
          console.log(`✅ POST bem-sucedido - Status: ${qrResponse.status}`);
          
          const qrCode = qrResponse.data?.qrcode || qrResponse.data?.qrCode || qrResponse.data?.base64;
          if (qrCode) {
            console.log(`✅ QR Code obtido com sucesso via POST!`);
            console.log(`📋 Tipo: ${typeof qrCode}`);
            console.log(`📋 Primeiros 50 chars: ${qrCode.substring(0, 50)}...`);
            qrCodeObtained = true;
            break;
          } else {
            console.log(`⚠️ POST retornou dados mas sem QR code: ${JSON.stringify(qrResponse.data)}`);
          }
        } catch (postError) {
          console.log(`❌ POST falhou: ${postError.message}`);
        }

        // Tentar GET se POST falhar
        try {
          const qrResponse = await axios.get(endpoint, { headers });
          console.log(`✅ GET bem-sucedido - Status: ${qrResponse.status}`);
          
          const qrCode = qrResponse.data?.qrcode || qrResponse.data?.qrCode || qrResponse.data?.base64;
          if (qrCode) {
            console.log(`✅ QR Code obtido com sucesso via GET!`);
            console.log(`📋 Tipo: ${typeof qrCode}`);
            console.log(`📋 Primeiros 50 chars: ${qrCode.substring(0, 50)}...`);
            qrCodeObtained = true;
            break;
          } else {
            console.log(`⚠️ GET retornou dados mas sem QR code: ${JSON.stringify(qrResponse.data)}`);
          }
        } catch (getError) {
          console.log(`❌ GET falhou: ${getError.message}`);
        }
      }

      if (!qrCodeObtained) {
        console.log('❌ Não foi possível obter QR code de nenhum endpoint');
      }

    } catch (listError) {
      console.log(`❌ Erro ao listar instâncias: ${listError.message}`);
      console.log(`📋 Detalhes: ${listError.response?.data ? JSON.stringify(listError.response.data) : 'Sem detalhes'}`);
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  } finally {
    await pool.end();
  }
}

// Executar teste
testInstanceGeneration().then(() => {
  console.log('\n🏁 Teste finalizado.');
});