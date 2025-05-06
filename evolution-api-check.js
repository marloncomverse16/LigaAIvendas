import axios from 'axios';

// Definições básicas
const apiUrl = 'https://api.primerastreadores.com';
const token = '4db623449606bcf2814521b73657dbc0';
const instance = 'admin';

// Função para testar se um endpoint existe
async function testEndpoint(method, path) {
  const url = `${apiUrl}${path}`;
  console.log(`\nTestando ${method.toUpperCase()} ${url}`);
  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Usamos OPTIONS para verificar quais métodos são suportados
    const response = await axios.request({
      method: 'OPTIONS',
      url: url,
      headers: headers
    });
    
    console.log('Cabeçalhos de resposta:', response.headers);
    
    // Verificar se o cabeçalho Allow existe, que indica quais métodos são suportados
    if (response.headers['allow']) {
      console.log(`Métodos permitidos: ${response.headers['allow']}`);
    }
    
    console.log('Endpoint existe e retornou status:', response.status);
    return true;
  } catch (error) {
    if (error.response) {
      console.log(`Erro ${error.response.status}: ${error.message}`);
      console.log('Cabeçalhos:', error.response.headers);
      return false;
    } else {
      console.log(`Erro de conexão: ${error.message}`);
      return false;
    }
  }
}

// Testar a versão da API para entender a estrutura de endpoints
async function checkApiVersion() {
  try {
    const response = await axios.get(apiUrl);
    console.log('Versão da API:', response.data.version);
    console.log('URL do Manager:', response.data.manager);
    return response.data;
  } catch (error) {
    console.log('Erro ao verificar versão da API:', error.message);
    return null;
  }
}

// Função principal
async function main() {
  // Verificar a versão primeiro
  const apiInfo = await checkApiVersion();
  if (!apiInfo) {
    console.log('Não foi possível obter informações da API. Abortando.');
    return;
  }
  
  // Baseado na versão e documentação, testar endpoints comuns da Evolution API
  const endpointsToTest = [
    { method: 'GET', path: '/instance/fetchInstances' },
    { method: 'POST', path: '/instance/create' },
    { method: 'GET', path: `/instance/qrcode/${instance}` },
    { method: 'GET', path: `/instance/connect/${instance}` },
    { method: 'GET', path: `/instance/connectionState/${instance}` },
    { method: 'GET', path: `/instance/status/${instance}` },
    { method: 'POST', path: `/instance/logout/${instance}` },
    { method: 'GET', path: `/instance/all` }
  ];
  
  // A URL do manager pode ter endpoints adicionais
  if (apiInfo.manager) {
    const managerUrl = apiInfo.manager.replace(/^http:/, 'https:');
    console.log(`\nTestando endpoints do Manager: ${managerUrl}`);
    
    // Se o manager estiver na mesma URL, mas em um caminho diferente
    if (managerUrl.includes(apiUrl)) {
      const managerPath = managerUrl.replace(apiUrl, '');
      endpointsToTest.push(
        { method: 'GET', path: `${managerPath}/instance/qrcode/${instance}` },
        { method: 'GET', path: `${managerPath}/instance/connectionState/${instance}` }
      );
    }
  }
  
  // Testar cada endpoint
  for (const endpoint of endpointsToTest) {
    await testEndpoint(endpoint.method, endpoint.path);
  }
}

main().catch(error => {
  console.error('Erro na execução principal:', error);
});