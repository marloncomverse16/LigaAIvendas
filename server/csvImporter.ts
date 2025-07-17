/**
 * Módulo específico para importação de arquivos CSV
 * Com detecção automática de separador e colunas
 */
import { IStorage } from "./storage";
import fs from "fs";

/**
 * Detecta o melhor separador para um arquivo CSV (vírgula ou ponto e vírgula)
 * @param content Conteúdo do arquivo CSV
 * @returns O separador detectado (',' ou ';')
 */
function detectSeparator(content: string): string {
  const lines = content.split('\n');
  if (lines.length < 2) return ',';
  
  const testLine = lines[1];
  
  // Verifica qual separador aparece com mais frequência
  if (testLine.indexOf(';') > -1 && 
      (testLine.indexOf(',') === -1 || testLine.split(';').length > testLine.split(',').length)) {
    console.log("Detectado separador de CSV como ponto e vírgula (;)");
    return ';';
  }
  
  console.log("Usando separador de CSV padrão como vírgula (,)");
  return ',';
}

/**
 * Encontra o índice de uma coluna específica nos cabeçalhos
 * @param headers Lista de cabeçalhos do CSV
 * @param fieldType Tipo de campo a ser encontrado (name, email, phone, etc)
 * @returns Índice da coluna ou -1 se não encontrado
 */
function findColumnIndex(headers: string[], fieldType: string): number {
  // Mapeia diferentes variações de nomes de colunas comumente usados
  // Expandimos as opções para cada campo para melhorar a detecção
  const nameMappings: {[key: string]: string[]} = {
    'name': ['nome', 'name', 'cliente', 'razão social', 'razao social', 'razaosocial', 'empresa', 'contato', 'responsável', 'responsavel', 'cliente/client', 'company', 'person', 'nome completo', 'full name'],
    'email': ['email', 'e-mail', 'correio', 'correio eletrônico', 'mail', 'electronic mail', 'e mail'],
    'phone': ['telefone', 'phone', 'celular', 'tel', 'contato', 'whatsapp', 'telefone 1', 'tel1', 'fone', 'mobile', 'telephone', 'numero', 'número', 'telefone/phone', 'tel/phone', 'telephone number', 'cel', 'cel/phone'],
    'address': ['endereco', 'endereço', 'address', 'logradouro', 'local', 'rua', 'avenida', 'av', 'local', 'localização', 'localizacao', 'location', 'street', 'end', 'end.'],
    'cidade': ['cidade', 'city', 'município', 'municipio', 'town', 'loc', 'localidade', 'cidade/city'],
    'estado': ['estado', 'state', 'uf', 'província', 'provincia', 'region', 'estado/state', 'state/uf', 'unidade federativa'],
    'site': ['site', 'website', 'web', 'pagina', 'página', 'url', 'link', 'domínio', 'dominio', 'domain', 'homepage', 'home page', 'www', 'http'],
    'type': ['tipo', 'type', 'category', 'categoria', 'segmento', 'ramo', 'tipo de negócio', 'tipo de negocio', 'tipo/type', 'business type', 'segmento', 'setor', 'sector', 'atividade', 'activity']
  };
  
  const possibleNames = nameMappings[fieldType] || [fieldType];
  
  // Converter todos os cabeçalhos para minúsculas e remover acentos para melhorar a correspondência
  const normalizedHeaders = headers.map(h => normalizeString(h));
  const normalizedPossibleNames = possibleNames.map(p => normalizeString(p));
  
  // Debug
  console.log(`Procurando por '${fieldType}'. Cabeçalhos normalizados:`, normalizedHeaders);
  
  // Primeiro tenta encontrar uma correspondência exata
  for (let i = 0; i < normalizedPossibleNames.length; i++) {
    const possibleName = normalizedPossibleNames[i];
    const originalName = possibleNames[i];
    
    const index = normalizedHeaders.findIndex(h => h === possibleName);
    if (index !== -1) {
      console.log(`Campo ${fieldType} encontrado exatamente como "${headers[index]}" (normalizado: "${normalizedHeaders[index]}") usando "${originalName}" no índice ${index}`);
      return index;
    }
  }
  
  // Em seguida, tenta correspondência parcial (contém ou está contido)
  for (let i = 0; i < normalizedPossibleNames.length; i++) {
    const possibleName = normalizedPossibleNames[i];
    const originalName = possibleNames[i];
    
    for (let j = 0; j < normalizedHeaders.length; j++) {
      const header = normalizedHeaders[j];
      
      if (header.includes(possibleName) || possibleName.includes(header)) {
        console.log(`Campo ${fieldType} encontrado parcialmente como "${headers[j]}" (normalizado: "${normalizedHeaders[j]}") usando "${originalName}" no índice ${j}`);
        return j;
      }
    }
  }
  
  // Tenta uma abordagem mais genérica para encontrar strings similares
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];
    for (let j = 0; j < normalizedPossibleNames.length; j++) {
      const possibleName = normalizedPossibleNames[j];
      const originalName = possibleNames[j];
      
      // Verifica se cabeçalho contém ao menos os primeiros 3 caracteres do nome possível
      // ou se o nome possível contém os primeiros 3 caracteres do cabeçalho
      if ((possibleName.length > 2 && header.includes(possibleName.substring(0, 3))) ||
          (header.length > 2 && possibleName.includes(header.substring(0, 3)))) {
        console.log(`Campo ${fieldType} encontrado por similaridade como "${headers[i]}" (normalizado: "${normalizedHeaders[i]}") usando "${originalName}" no índice ${i}`);
        return i;
      }
    }
  }
  
  // Verificar palavras compostas (para campos como 'tel/cel' ou 'endereco comercial')
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];
    // Dividir por símbolos comuns que podem separar conceitos
    const parts = header.split(/[\/\-_.,;:|&+\s]+/);
    
    if (parts.length > 1) {
      for (const part of parts) {
        if (part.length < 2) continue;  // Ignorar partes muito curtas
        
        for (let j = 0; j < normalizedPossibleNames.length; j++) {
          const possibleName = normalizedPossibleNames[j];
          const originalName = possibleNames[j];
          
          if (possibleName.includes(part) || 
              (part.length > 2 && possibleName.includes(part.substring(0, 3)))) {
            console.log(`Campo ${fieldType} encontrado em palavra composta "${headers[i]}" (parte: "${part}") usando "${originalName}" no índice ${i}`);
            return i;
          }
        }
      }
    }
  }
  
  // Última tentativa: verificar números nos nomes de campos (tel1, telefone2, etc)
  if (fieldType === 'phone') {
    const phonePatterns = [/tel[0-9]/, /phone[0-9]/, /fone[0-9]/, /celular[0-9]/, /cel[0-9]/];
    for (let i = 0; i < normalizedHeaders.length; i++) {
      const header = normalizedHeaders[i];
      for (const pattern of phonePatterns) {
        if (pattern.test(header)) {
          console.log(`Campo ${fieldType} encontrado por padrão numérico "${headers[i]}" (${pattern}) no índice ${i}`);
          return i;
        }
      }
    }
  }
  
  console.log(`Campo ${fieldType} NÃO encontrado em nenhum cabeçalho`);
  return -1;
}

/**
 * Normaliza uma string: converte para minúsculas e remove acentos
 */
function normalizeString(str: string): string {
  return str.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Decodifica caracteres especiais que podem ter sido mal interpretados
 * durante a leitura do arquivo CSV
 */
function decodeSpecialChars(str: string): string {
  try {
    // Tenta múltiplas abordagens para lidar com caracteres especiais
    let decoded = str;
    
    // Substituir símbolos conhecidos por problema de encoding
    const replacements: Record<string, string> = {
      'Ã£': 'ã', 'Ã¡': 'á', 'Ã¢': 'â', 'Ã ': 'à', 'Ã©': 'é',
      'Ãª': 'ê', 'Ã­': 'í', 'Ã³': 'ó', 'Ã´': 'ô', 'Ãµ': 'õ',
      'Ãº': 'ú', 'Ã§': 'ç', 'Ã‡': 'Ç', 'Ã€': 'À', 'Ã': 'Á',
      'Ã‚': 'Â', 'Ãƒ': 'Ã', 'Ã‰': 'É', 'ÃŠ': 'Ê', 'S�o': 'São',
      'S�': 'Sã', '�o': 'ão', 'S\u00E3o': 'São'
    };
    
    // Aplicar substituições específicas
    Object.entries(replacements).forEach(([bad, good]) => {
      decoded = decoded.replace(new RegExp(bad, 'g'), good);
    });
    
    // Se o texto ainda parece ter problemas, tenta normalizar de outra forma
    if (decoded.includes('�') || decoded.includes('?')) {
      // Usa uma abordagem mais simples, removendo caracteres problemáticos
      decoded = decoded
        .replace(/[^\w\s.,;:()'"/\\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    return decoded;
  } catch (e) {
    // Em caso de erro, retorna a string original
    return str;
  }
}

/**
 * Formata um número de telefone para o padrão WhatsApp
 * Exemplo de entrada: "+55 (43) 99114-2751"
 * Exemplo de saída: "5543991142751"
 */
function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Se parece ser notação científica (como 5.54E+12), tenta converter corretamente
  if (phone.includes('E+') || phone.includes('e+')) {
    try {
      // Converte para número e depois para string para remover a notação científica
      const num = Number(phone);
      if (!isNaN(num)) {
        return String(num).replace(/\D/g, '');
      }
    } catch (e) {
      // Se falhar, continua com o processamento normal
    }
  }
  
  // Remove todos os caracteres não numéricos
  let cleaned = phone.replace(/\D/g, '');
  
  // Se começar com zero, remove-o
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Se não tiver o código do país (55 para Brasil) e tiver pelo menos 10 dígitos (DDD + número)
  // consideramos que é um número brasileiro e adicionamos o 55
  if (!cleaned.startsWith('55') && cleaned.length >= 10) {
    cleaned = '55' + cleaned;
  }
  
  // Se for um número muito curto ou inválido, registra um aviso
  if (cleaned.length < 10) {
    console.warn(`Número de telefone possivelmente inválido após formatação: ${cleaned} (original: ${phone})`);
  }
  
  return cleaned;
}

/**
 * Importa dados de um arquivo CSV para o sistema de prospecção
 * @param fileContent Conteúdo do arquivo CSV como string
 * @param searchId ID da busca de prospecção
 * @param storage Instância do armazenamento
 * @returns Dados processados e número de leads importados
 */
export async function importCSVContent(
  fileContent: string, 
  searchId: number,
  storage: IStorage
): Promise<{ importedLeads: number, errorLeads: number, message: string }> {
  try {
    // Log detalhado do conteúdo inicial para debug
    console.log(`🔍 [CSV Import Debug] SearchID: ${searchId}`);
    console.log(`📝 [CSV Import Debug] Primeiras 200 chars do CSV:`, fileContent.substring(0, 200));
    console.log(`📊 [CSV Import Debug] Total chars: ${fileContent.length}`);
    console.log(`📋 [CSV Import Debug] Total linhas: ${fileContent.split('\n').length}`);
    
    const lines = fileContent.split('\n');
    
    if (lines.length < 2) {
      return { 
        importedLeads: 0, 
        errorLeads: 0, 
        message: "Arquivo vazio ou sem dados suficientes" 
      };
    }
    
    // Detectar separador ideal para este arquivo
    const separator = detectSeparator(fileContent);
    console.log(`🔨 [CSV Import Debug] Separador detectado: "${separator}"`);
    
    // Obter e processar cabeçalhos
    const headers = lines[0].split(separator).map(h => h.trim().toLowerCase());
    console.log(`📋 [CSV Import Debug] Cabeçalhos detectados:`, headers);
    console.log(`📋 [CSV Import Debug] Primeira linha raw:`, lines[0]);
    
    // Identificar índices de colunas
    const nameIndex = findColumnIndex(headers, 'name');
    const emailIndex = findColumnIndex(headers, 'email');
    const phoneIndex = findColumnIndex(headers, 'phone');
    
    console.log(`🔍 [CSV Import Debug] Índices encontrados:`);
    console.log(`   - Nome: ${nameIndex} (${nameIndex >= 0 ? headers[nameIndex] : 'NÃO ENCONTRADO'})`);
    console.log(`   - Email: ${emailIndex} (${emailIndex >= 0 ? headers[emailIndex] : 'NÃO ENCONTRADO'})`);
    console.log(`   - Telefone: ${phoneIndex} (${phoneIndex >= 0 ? headers[phoneIndex] : 'NÃO ENCONTRADO'})`);
    
    // Estratégia para resolver problema de não conseguir identificar colunas:
    // Se não encontrarmos nenhuma coluna automaticamente, vamos utilizar
    // as primeiras colunas do arquivo como nome, email e telefone (se disponíveis)
    let nameIdx = nameIndex;
    let emailIdx = emailIndex;
    let phoneIdx = phoneIndex;
    
    // Se não temos nenhum campo detectado automaticamente, vamos usar um mapeamento forçado
    const needsForceMapping = nameIndex === -1 && emailIndex === -1 && phoneIndex === -1;
    
    if (needsForceMapping) {
      console.log("AVISO: Nenhuma coluna mapeada automaticamente. Tentando mapeamento forçado...");
      
      // Usa as primeiras colunas disponíveis assumindo uma ordem comum
      if (headers.length > 0) nameIdx = 0;  // Primeira coluna como nome
      if (headers.length > 1) emailIdx = 1; // Segunda coluna como email
      if (headers.length > 2) phoneIdx = 2; // Terceira coluna como telefone
      
      console.log("Mapeamento forçado:", {
        nome: headers[nameIdx] || "indisponível",
        email: emailIdx >= 0 ? headers[emailIdx] : "indisponível",
        telefone: phoneIdx >= 0 ? headers[phoneIdx] : "indisponível"
      });
    }
    
    // Obter índices de todas as colunas possíveis
    const addressIdx = findColumnIndex(headers, 'address');
    const cidadeIdx = findColumnIndex(headers, 'cidade');
    const estadoIdx = findColumnIndex(headers, 'estado');
    const siteIdx = findColumnIndex(headers, 'site');
    const typeIdx = findColumnIndex(headers, 'type');
    
    let importedLeads = 0;
    let errorLeads = 0;
    
    // Processar linhas
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(separator).map(v => v.trim());
      
      // Aceita linhas mesmo que não tenham todas as colunas
      if (values.length < 1) continue;
      
      // Preparar objeto com a estrutura esperada pela interface InsertProspectingResult
      const lead: {
        searchId: number;
        name?: string | null;
        email?: string | null;
        phone?: string | null;
        address?: string | null;
        cidade?: string | null;
        estado?: string | null;
        site?: string | null;
        type?: string | null;
      } = { 
        searchId: searchId 
      };
      
      // Adiciona campos usando os índices identificados, com tratamento especial para certos campos
      if (nameIdx !== -1 && values[nameIdx]) {
        // Nome: mantém como está, mas garante que está decodificado corretamente
        try {
          lead.name = decodeSpecialChars(values[nameIdx]);
        } catch (e) {
          lead.name = values[nameIdx];
        }
      }
      
      if (emailIdx !== -1 && values[emailIdx]) {
        // Email: remove espaços extras
        lead.email = values[emailIdx].trim();
      }
      
      if (phoneIdx !== -1 && values[phoneIdx]) {
        // Telefone: formata no padrão 5543991142751
        lead.phone = formatPhoneNumber(values[phoneIdx]);
      }
      
      if (addressIdx !== -1 && values[addressIdx]) {
        // Endereço: garante que está decodificado corretamente
        try {
          lead.address = decodeSpecialChars(values[addressIdx]);
        } catch (e) {
          lead.address = values[addressIdx];
        }
      }
      
      // Tratamento especial para cidade e estado
      // Se os dois índices são os mesmos, provavelmente é um campo combinado como "cidade:estado"
      if (cidadeIdx !== -1 && estadoIdx !== -1 && cidadeIdx === estadoIdx) {
        const combinedValue = values[cidadeIdx];
        if (combinedValue) {
          // Verifica se há separadores comuns como ':', '-', '/' entre cidade e estado
          const separators = [':', '-', '/', '|', ','];
          let cidadeValue = combinedValue;
          let estadoValue = null;
          
          for (const sep of separators) {
            if (combinedValue.includes(sep)) {
              const parts = combinedValue.split(sep).map(p => p.trim());
              if (parts.length >= 2) {
                cidadeValue = parts[0];
                estadoValue = parts[1];
                console.log(`Campo combinado cidade/estado separado usando "${sep}": cidade="${cidadeValue}", estado="${estadoValue}"`);
                break;
              }
            }
          }
          
          // Decodifica caracteres especiais antes de atribuir
          try {
            lead.cidade = decodeSpecialChars(cidadeValue);
          } catch (e) {
            lead.cidade = cidadeValue;
          }
          
          if (estadoValue) {
            try {
              lead.estado = decodeSpecialChars(estadoValue);
            } catch (e) {
              lead.estado = estadoValue;
            }
          }
        }
      } else {
        // Processamento normal quando são campos separados
        if (cidadeIdx !== -1 && values[cidadeIdx]) {
          try {
            lead.cidade = decodeSpecialChars(values[cidadeIdx]);
          } catch (e) {
            lead.cidade = values[cidadeIdx];
          }
        }
        
        if (estadoIdx !== -1 && values[estadoIdx]) {
          try {
            lead.estado = decodeSpecialChars(values[estadoIdx]);
          } catch (e) {
            lead.estado = values[estadoIdx];
          }
        }
      }
      
      if (siteIdx !== -1 && values[siteIdx]) {
        lead.site = values[siteIdx].trim();
      }
      
      if (typeIdx !== -1 && values[typeIdx]) {
        try {
          lead.type = decodeSpecialChars(values[typeIdx]);
        } catch (e) {
          lead.type = values[typeIdx];
        }
      }
      
      // Certifica que ao menos um dos campos principais tem valor
      if (!lead.name && !lead.email && !lead.phone) {
        console.log(`Linha ${i+1} ignorada: nenhum campo principal preenchido`);
        errorLeads++;
        continue;
      }
      
      try {
        await storage.createProspectingResult(lead);
        importedLeads++;
      } catch (err) {
        console.error(`Erro ao salvar linha ${i+1}:`, err);
        errorLeads++;
      }
    }
    
    return {
      importedLeads,
      errorLeads,
      message: `Importação concluída: ${importedLeads} leads adicionados, ${errorLeads} erros`
    };
  } catch (error) {
    console.error("Erro ao processar arquivo CSV:", error);
    return {
      importedLeads: 0,
      errorLeads: 0,
      message: `Erro ao processar arquivo: ${error}`
    };
  }
}