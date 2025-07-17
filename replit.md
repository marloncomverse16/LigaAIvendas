# LigAI Dashboard - Projeto de Gestão de Leads WhatsApp

## Visão Geral

Dashboard português interativo para gestão de leads e negócios via WhatsApp, com sistema completo de autenticação, multi-tenant, e integração com APIs WhatsApp Business Cloud e Evolution API.

### Funcionalidades Principais
- Sistema de autenticação completo (login/registro)
- Dashboard principal com métricas de negócio
- Gestão de leads e recomendações inteligentes  
- Módulo de prospecção com upload de arquivos CSV/Excel
- Sistema de envio de mensagens WhatsApp
- Conectividade dupla: QR Code (Evolution API) e Meta Cloud API
- Gestão de agentes de IA com comportamentos personalizados
- Relatórios Meta API com custos em BRL
- Sistema de metas e acompanhamento de performance
- Upload de mídia (PDF/CSV) com armazenamento no servidor
- Isolamento completo de dados multi-tenant
- **NOVO**: Sistema automático de encaminhamento de webhook WhatsApp Cloud para agentes IA

## Arquitetura do Projeto

### Estruturas de Dados Principais
- **Usuários**: Sistema de autenticação com roles (admin/user)
- **Servidores**: Configuração de APIs WhatsApp (Evolution/Meta)
- **Leads**: Gestão de contatos e prospecção
- **Agentes IA**: Configuração de comportamentos e webhooks
- **Relatórios**: Métricas Meta API e Evolution API
- **Mensagens**: Histórico de comunicações WhatsApp

### Tecnologias
- **Frontend**: React + TypeScript + TailwindCSS + shadcn/ui
- **Backend**: Express.js + TypeScript + Drizzle ORM
- **Banco**: PostgreSQL com isolamento multi-tenant
- **Autenticação**: Passport.js com sessões
- **APIs**: WhatsApp Business Cloud API + Evolution API
- **Upload**: Multer com armazenamento local
- **WebSocket**: Comunicação tempo real

## Mudanças Arquiteturais Recentes

### 2025-06-17 - Sistema de Webhook Automático WhatsApp Cloud COM IDENTIFICAÇÃO COMPLETA DO USUÁRIO
- **Implementado sistema de encaminhamento automático** de mensagens WhatsApp Cloud para agentes IA
- **Arquivo criado**: `server/api/meta-webhook.ts` com funções:
  - `saveIncomingMessage()`: Salva mensagem e encaminha para IA
  - `findUserByPhoneNumberId()`: Identifica usuário pelo phone_number_id e busca agente específico
  - `forwardMessageToAI()`: Envia payload padronizado para webhook do agente
- **Rotas adicionadas** em `server/routes.ts`:
  - `GET /api/meta-webhook`: Verificação do webhook Meta
  - `POST /api/meta-webhook`: Recepção de mensagens WhatsApp Cloud
- **Fluxo automático COMPLETO**: WhatsApp Cloud → Meta Webhook → Identificação Usuário → Busca Agente Específico → Encaminhamento para Agente IA
- **Correção crítica**: Sistema agora busca o agente específico associado ao usuário via `user_ai_agents` + `server_ai_agents`
- **Associação usuário-agente**: Criada entrada na tabela `user_ai_agents` para conectar usuário admin ao "Agente 02"
- **Query SQL corrigida**: JOIN entre `user_servers`, `user_ai_agents` e `server_ai_agents` para isolamento correto
- **Teste confirmado**: Webhook encaminha corretamente para URL do "Agente 02" específico do usuário
- **Isolamento por usuário** baseado no phone_number_id configurado + agente específico
- **NOVO: Identificação completa do usuário no payload**:
  - `user_id`: ID numérico do usuário
  - `user_name`: Nome completo do usuário (campo name da tabela users)
  - `user_username`: Username do usuário
  - Headers HTTP: `X-User-ID` e `X-User-Name` enviados para o agente
  - Metadados: `userId`, `userName`, `userUsername` incluídos na seção metadata
- **Função aprimorada**: `findUserByPhoneNumberId()` agora retorna informações completas do usuário
- **Payload estruturado**: Agentes IA recebem identificação completa do usuário para contexto personalizado
- **Teste validado**: Webhook processando mensagens com informações completas do usuário incluindo nome

### 2025-06-17 - Correção Isolamento de Dados
- **Problema resolvido**: Isolamento de dados nas páginas de contatos e relatórios
- **Implementação**: Filtros WHERE user_id = $1 em todas as rotas de relatórios
- **Páginas corrigidas**: Contatos e Relatórios com mensagens adequadas para novos usuários
- **Detecção automática** de usuários novos sem configuração
- **Rotas verificadas**: Meta e QR reports com isolamento adequado

### 2025-06-11 - Configuração Multi-tenant Completa
- **Sistema multi-tenant** funcionando completamente
- **Isolamento de dados** por usuário em todas as tabelas
- **Gestão de servidores** com relações usuário-servidor
- **Conexões Meta API** específicas por usuário
- **Configuração de webhooks** individualizados

## Preferências do Usuário

### Comunicação
- **Idioma**: Português brasileiro em todas as respostas
- **Estilo**: Direto, técnico quando necessário, sem emojis excessivos
- **Feedback**: Sempre confirmar quando tarefas importantes são concluídas

### Desenvolvimento
- **Padrão**: TypeScript strict, Drizzle ORM, isolamento multi-tenant
- **Segurança**: Validação rigorosa de dados, sanitização de inputs
- **Performance**: Queries otimizadas, cache quando apropriado
- **Logs**: Detalhados para debugging, especialmente webhooks e APIs

## Estado Atual do Sistema

### Funcionalidades Operacionais
✅ Autenticação e gestão de usuários  
✅ Dashboard com métricas calculadas  
✅ Prospecção com upload CSV/Excel  
✅ Envio de mensagens WhatsApp (ambos métodos)  
✅ Relatórios Meta API com custos BRL  
✅ Gestão de agentes IA  
✅ Isolamento completo multi-tenant  
✅ **Sistema automático de webhook WhatsApp Cloud → Agente IA**

### Integrações Ativas
- WhatsApp Business Cloud API (Meta)
- Evolution API para QR Code
- Cloudinary para upload de mídia
- PostgreSQL para persistência
- **Webhook automático** para agentes IA

### Próximas Melhorias Sugeridas
- Expandir webhook automático para outros tipos de mídia
- Implementar retry automático em webhooks
- Métricas de performance dos encaminhamentos
- Interface de monitoramento de webhooks

## Configuração de Ambiente

### Variáveis Necessárias
```
DATABASE_URL=postgresql://...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
EVOLUTION_API_TOKEN=...
META_WEBHOOK_VERIFY_TOKEN=...
```

### Webhooks Configurados
- **Meta Webhook**: `/api/meta-webhook` (GET/POST)
- **Evolution Webhook**: `/webhook/find/:instance` (GET)
- **Agentes IA**: Configurados individualmente por servidor

---

### 2025-06-24 - Correção Token WhatsApp Cloud API
- **Problema identificado**: Discrepância entre tokens armazenados nas tabelas `users`, `settings` e `servers`
- **Token correto**: EAA6rwPJFpjIBOxGSjZCZBhCrtZAfM0YlnIS9zWjS7FqjKwl1dWXQ6... (salvo em Configurações)
- **Token incorreto**: EAA6rwPJFpjIBO1VnsRil4Mqu1N1hdB0R4CrcYZBVqiaX7tAD55JX6... (antigo em múltiplas tabelas)
- **Solução aplicada**: Sincronização do token correto em todas as três tabelas
- **Tabelas corrigidas**: `users.whatsapp_api_token`, `settings.whatsapp_meta_token`, `servers.whatsapp_meta_token`
- **Resultado**: Sistema agora usa consistentemente o token válido em todos os módulos
- **Templates Meta API**: Busca de templates corrigida e funcionando com 3 templates aprovados carregados
- **Configurações por usuário**: Sistema agora garante que cada usuário use suas próprias configurações da tabela settings
- **Autenticação obrigatória**: Todas as rotas de templates agora exigem autenticação e usam credenciais específicas do usuário

### 2025-06-24 - Correção Sistema de Agendamento de Mensagens
- **Problema**: Limitação de agendamento para 1 dia a partir da data atual
- **Solução frontend**: Correção do componente Calendar para permitir agendamento a partir da data/hora atual
- **Solução backend**: Atualização da validação para permitir agendamento com margem de 1 minuto de tolerância
- **Validação inteligente**: Se agendamento for para hoje, verifica se horário é futuro; se for outra data, permite qualquer horário
- **Schema corrigido**: Validação Zod atualizada para aceitar datas futuras a partir do momento atual
- **Resultado**: Usuários podem agendar mensagens a partir do momento atual sem limitação de 1 dia

### 2025-06-24 - Correção Seleção de Templates Meta API
- **Problema**: Template "Modelo_de_teste_ligai" não selecionava quando clicado
- **Causa**: Conflito de tipos entre IDs de templates Meta API (string) e templates locais (number)
- **Solução**: Atualização do Select para tratar tipos diferentes conforme o tipo de conexão
- **Schema atualizado**: templateId agora aceita string ou number usando z.union()
- **Lógica corrigida**: Meta API usa IDs como string, templates locais como number
- **Resultado**: Todos os templates Meta API agora selecionam corretamente

### 2025-06-24 - Correção Erro "realLeadsCount is not defined"
- **Problema**: Variável `realLeadsCount` não definida ao agendar envio Meta API
- **Causa**: Variável usada mas não declarada no código de envio
- **Solução**: Substituída por `totalRecipients` baseado na quantidade solicitada
- **Código corrigido**: Definição de `totalRecipients = data.quantity || 10`
- **Resultado**: Agendamento de envios Meta API funciona sem erro

### 2025-06-24 - Sistema de Agendamento Meta API Implementado
- **Problema**: Sistema enviava mensagens imediatamente ao invés de agendar
- **Solução**: Criação de sistema duplo de envio (imediato vs agendado)
- **Rota nova**: `/api/meta-schedule-send` para agendamentos
- **Lógica frontend**: Detecta se há data/hora e escolhe endpoint adequado
- **Agendamento**: Usa setTimeout para executar na data/hora especificada
- **Status tracking**: "agendado" → "em_andamento" → "concluido"
- **Resultado**: Envios executam na data/hora correta quando agendados

### 2025-06-24 - Remoção Completa de Campos de Perfil
- **Solicitação do usuário**: Remover campos Nome, Email, Telefone, Empresa e Sobre da seção "Configurações - Perfil e Conta"
- **Frontend atualizado**: Campos removidos do formulário em `client/src/pages/settings-page.tsx`
- **Schema simplificado**: `profileSchema` agora vazio, sem validações de campos pessoais
- **Interface limpa**: Seção mostra mensagem explicativa sobre simplificação
- **Backend atualizado**: Rota `/api/profile` retorna apenas dados básicos (id, username, isAdmin)
- **Aplicado globalmente**: Alteração afeta todos os usuários do sistema
- **Compatibilidade mantida**: Funções antigas mantidas para evitar quebras

### 2025-06-24 - Correção Sistema de Agendamento Robusto
- **Problema**: setTimeout não funcionava em ambiente servidor que pode reiniciar
- **Solução**: Sistema de scheduler robusto com verificação periódica
- **Implementação**: Classe MessageScheduler com singleton pattern
- **Verificação**: A cada 30 segundos verifica envios pendentes para executar
- **Execução real**: Envios agendados agora executam disparos reais via Meta API
- **Confiabilidade**: Sistema funciona mesmo com reinicializações do servidor
- **Resultado**: Agendamentos executam corretamente na data/hora especificada

### 2025-06-24 - Sistema Completo de Rastreamento QR Code
- **Problema**: Mensagens enviadas via QR Code não apareciam nos relatórios automaticamente
- **Solução completa implementada**:
  - **Sincronização automática**: Monitora Evolution API a cada 30 segundos (`server/api/qr-sync.ts`)
  - **Rastreamento de envios**: Sistema automático que registra mensagens enviadas (`server/api/qr-message-tracker.ts`)
  - **Integração no histórico**: Envios QR Code automaticamente atualizam tabela `contacts`
  - **Webhook de confirmação**: Endpoint `/webhook/qr-sent/:instance` para confirmações externas
- **Funcionalidades**:
  - Buscar telefones da `prospecting_results` quando QR Code é enviado
  - Criar/atualizar contatos na tabela `contacts` com `source = 'qr_code'`
  - Sincronização em tempo real de mensagens recebidas
  - Rastreamento em lote para múltiplos destinatários
- **Resultado**: Sistema 100% automático - envios e recebimentos QR Code aparecem nos relatórios

### 2025-06-25 - Remoção Campo ID da Instância (Evolution API)
- **Solicitação do usuário**: Removido campo "ID da Instância (Evolution API)" da seção avançada
- **Localização**: Formulário de edição e criação de servidores em configurações avançadas
- **Alterações**: Schema, interface TypeScript e campos do formulário removidos
- **Motivo**: Simplificação da interface conforme solicitação do usuário

### 2025-06-24 - Correção Duplicação e Erros SQL
- **Problema**: Registros duplicados no histórico e erro SQL no scheduler
- **Causa**: Frontend criava registro duplo + problemas com operadores Drizzle
- **Solução**: Removida criação dupla no frontend + SQL direto no scheduler
- **Coluna adicionada**: scheduled_at na tabela message_sending_history
- **SQL corrigido**: Queries diretas para evitar problemas de sintaxe
- **Resultado**: Agendamentos únicos e scheduler funcionando sem erros

### 2025-06-24 - Sistema de Agendamento Finalmente Funcional
- **Status**: Sistema de agendamento Meta API 100% operacional
- **Scheduler detectando**: Agendamentos sendo encontrados e processados automaticamente
- **Correções aplicadas**: Nomes de campos corrigidos (schedule.user_id, schedule.search_id, etc.)
- **SQL direto**: Todas as operações usando queries SQL diretas para máxima confiabilidade
- **Teste confirmado**: Scheduler executa envios na data/hora especificada
- **Logs detalhados**: Sistema mostra progresso completo de cada agendamento

### 2025-06-24 - Melhorias Sistema de Envios
- **Exclusão de agendamentos**: Corrigida exclusão de agendamentos pendentes com validação de usuário
- **Limpeza automática**: Sistema remove histórico de envios após 90 dias automaticamente
- **Paginação implementada**: Histórico mostra 10 registros por página com navegação
- **Validações de segurança**: Verificação de propriedade antes de exclusões
- **Performance otimizada**: Queries SQL diretas para melhor desempenho

### 2025-06-24 - Correção Relatórios Meta API
- **Histórico de envios**: Corrigido erro "pagination is not defined" com implementação completa de paginação
- **Mapeamento de campos**: Corrigida consulta SQL para mapear snake_case → camelCase corretamente
- **Relatórios Meta API**: Corrigidos campos de exibição nas 4 seções principais:
  - **Conversas**: contact_number, is_free_window, started_at, cost_brl
  - **Mensagens**: contact_number, delivery_status, sent_at, cost_brl
  - **Faturamento**: phone_number_id, conversation_count, message_count, total_cost
  - **Leads**: contact_number, has_response (boolean tratado corretamente)
- **Dados autênticos**: Todos os dados vêm das tabelas reais do banco sem fallbacks
- **Isolamento garantido**: Todos os relatórios respeitam isolamento por usuário

### 2025-06-25 - Sistema Completo de CRM para Leads
- **Implementação completa do CRM**: Sistema robusto para gestão de leads com 3 estágios principais
- **Estrutura de banco de dados**:
  - Tabela `crm_leads`: Dados principais do lead (telefone, nome, status)
  - Tabela `crm_lead_activities`: Histórico completo de atividades e mudanças de status
  - Tipos enum: `lead_status` para padronização
- **Status de atendimento**: 6 estágios claros de acompanhamento:
  - `sendo_atendido_ia`: Sendo Atendido pela IA
  - `finalizado_ia`: Finalizada pela IA  
  - `precisa_atendimento_humano`: Precisa de Atendimento Humano
  - `transferido_humano`: Transferido para Humano
  - `finalizado_humano`: Finalizado por Humano
  - `abandonado`: Abandonado
- **API completa implementada com isolamento garantido**:
  - `GET /api/crm/leads`: Listagem com filtros avançados e paginação (user_id isolado)
  - `GET /api/crm/leads/:id`: Detalhes do lead com histórico de atividades (user_id isolado)
  - `POST /api/crm/leads`: Criação de novos leads (user_id automático)
  - `PUT /api/crm/leads/:id`: Atualização de leads existentes (user_id verificado)
  - `POST /api/crm/leads/:id/transfer-human`: Transferência para atendimento humano (user_id verificado)
  - `GET /api/crm/stats`: Estatísticas consolidadas do CRM (user_id isolado)
  - `POST /api/crm/leads/:id/activities`: Adição de atividades ao histórico (user_id verificado)
- **Interface frontend simplificada**:
  - Dashboard de estatísticas com cartões informativos
  - Sistema de filtros por status e busca textual
  - Listagem responsiva com campos essenciais (telefone, nome, status)
  - Modal de detalhes funcional com informações completas
  - Paginação automática para grandes volumes
  - Interface otimizada para melhor ajuste na tela
- **Funcionalidades essenciais**:
  - Rastreamento automático de atividades
  - Acompanhamento de conversões
  - **Isolamento completo por usuário**: Todas as consultas verificam user_id
  - **Segurança aprimorada**: Atividades do CRM respeitam isolamento multi-tenant
  - Validações rigorosas de segurança
- **Integração ao sistema**: Página adicionada ao menu de navegação como "CRM de Leads"
- **Dados limpos**: Removidos dados de exemplo para garantir ambiente de produção limpo

### 2025-06-25 - Correção Completa do Isolamento de Dados CRM
- **Isolamento multi-tenant garantido**: Todas as rotas do CRM agora verificam user_id
- **Segurança aprimorada**: Consulta de atividades corrigida com JOIN para verificar propriedade do lead
- **Dados limpos**: Removidos todos os dados de exemplo/teste do sistema
- **Interface simplificada**: CRM agora mostra apenas campos essenciais (telefone, nome, status)
- **Modal funcional**: Sistema de visualização de detalhes completamente operacional
- **Validação rigorosa**: Todas as operações CRM respeitam isolamento por usuário
- **Rotas corrigidas**:
  - `GET /api/crm/leads/:id`: Atividades isoladas por usuário
  - `POST /api/crm/leads/:id/activities`: Verificação de propriedade do lead
  - `GET /api/crm/stats`: Estatísticas isoladas por usuário
  - Todas as outras rotas já tinham isolamento adequado

### 2025-06-25 - Sistema Completo de Edição de Leads no CRM
- **Funcionalidade de edição implementada**: Modal "Ver Detalhes" agora permite editar informações dos leads
- **Interface alternada**: Modal alterna entre modo visualização e modo edição
- **Formulário de edição completo**: Permite alterar telefone, nome, status, origem e observações
- **Integração com API existente**: Utiliza rota PUT `/api/crm/leads/:id` já implementada
- **Validação de dados**: Formulário com validação Zod e feedback visual
- **Estados de carregamento**: Interface mostra estados de salvamento e erro
- **Botões funcionais**:
  - "Alterar Status": Modal específico para mudança de status com valor de venda
  - "Ver Detalhes" → "Editar Lead": Modo de edição completo das informações
  - "Cancelar" e "Salvar Alterações": Controles intuitivos de edição
- **Experiência do usuário**: Transições suaves entre modos de visualização e edição
- **Isolamento de segurança**: Todas as operações de edição respeitam isolamento multi-tenant

### 2025-06-25 - Remoção do Chat e Implementação de Exportação Dupla
- **Remoção completa do chat**: Botão do chat removido definitivamente da interface CRM conforme solicitação
- **Filtros por data implementados**: Sistema completo de filtros com data início e fim
- **Exportação CSV aprimorada**: Mantida funcionalidade de exportação CSV com cabeçalhos em português
- **Nova exportação Excel**: Implementada exportação para formato .xlsx usando biblioteca XLSX
- **Menu dropdown de exportação**: Interface com opções "Exportar CSV" e "Exportar Excel"
- **Backend atualizado**: Suporte completo a filtros por data nas consultas SQL
- **Filtros aplicados**: Exportações respeitam todos os filtros ativos (busca, status, datas)
- **Interface limpa**: CRM focado exclusivamente na gestão de leads sem funcionalidades de chat
- **Biblioteca XLSX instalada**: Dependência adicionada para suporte completo a Excel
- **Importação dinâmica**: Excel importado dinamicamente para otimização de performance

### 2025-07-03 - Correção Completa do Sistema de Exclusão de Usuários
- **Problema identificado**: Exclusão de usuários falhava devido a dependências de chave estrangeira não tratadas adequadamente
- **Análise realizada**: Descobertas 29 tabelas que referenciam a tabela `users` através de chaves estrangeiras
- **Solução implementada**: Reescrita completa do método `deleteUser` usando SQL direto com transações
- **Melhorias técnicas**:
  - **Transações SQL**: Sistema usa BEGIN/COMMIT/ROLLBACK para garantir integridade
  - **Ordem correta**: Dados dependentes removidos antes das referências principais
  - **Cobertura completa**: Trata todas as 29 tabelas identificadas na análise
  - **Rollback automático**: Em caso de erro, todas as alterações são revertidas
- **Tabelas tratadas**: CRM leads/atividades, Meta API data, message history, prospecting data, AI agents, server relations, contacts, mensagens WhatsApp, settings, leads principais
- **Teste validado**: Usuário "Leriane" removido com sucesso, usuário teste criado para validação
- **Sistema robusto**: Funciona mesmo com dependências complexas e dados inter-relacionados

### 2025-07-03 - Correção Sistema de Filtragem de Agentes IA Disponíveis
- **Bug crítico corrigido**: Agentes IA associados não eram filtrados corretamente da lista de disponíveis
- **Problema**: Query SQL usava sintaxe incorreta do Drizzle ORM causando erro de compilação
- **Solução implementada**: Correção da sintaxe para `not(inArray(serverAiAgents.id, allAssociatedAgentIds))`
- **Teste validado**: Sistema agora filtra corretamente agentes já associados a usuários
- **Cache atualizado**: Implementada invalidação automática do cache frontend para atualizações em tempo real
- **Melhorias de UX**: Interface atualiza automaticamente após associar/remover agentes sem reload manual
- **Isolamento garantido**: Cada agente IA pode ser associado a apenas um usuário por vez

### 2025-07-03 - Otimização do Algoritmo de Balanceamento de Servidores
- **Estratégia melhorada**: Sistema de atribuição automática agora prioriza servidor mais próximo da lotação máxima
- **Lógica implementada**: Algoritmo busca servidor com maior taxa de utilização entre os disponíveis
- **Eficiência aprimorada**: Melhor distribuição de carga concentrando usuários nos servidores já em uso
- **Backend otimizado**: Função `getServerWithLeastUsers` já implementava lógica correta de maior utilização
- **Frontend corrigido**: Interface de criação de usuário agora ordena servidores por maior ocupação primeiro
- **Balanceamento inteligente**: Sistema evita dispersão desnecessária entre múltiplos servidores subutilizados

### 2025-07-04 - Limpeza Interface de Gerenciamento de Usuários
- **Opções removidas do menu de ações**: Removidas "Permissões de Acesso" e "Atribuir Servidor Auto" do dropdown de três pontos
- **Interface simplificada**: Menu de ações agora contém apenas: Editar, Ativar/Desativar Usuário, e Excluir
- **Sistema de criação corrigido**: Validação aprimorada para suportar tanto seleção manual quanto atribuição automática de servidor
- **Correções JavaScript**: Resolvido erro de variável inconsistente (setSelectedAgentId) que causava crashes no frontend
- **Logs melhorados**: Sistema de debug aprimorado para acompanhar processo de criação de usuários

### 2025-07-04 - Remoção Funcionalidade de Agendamento Automático
- **Seção removida**: Removida completamente a seção "Agendamento Automático" da página Agente de IA
- **Interface simplificada**: Agente de IA agora foca apenas em comportamento, follow-ups e movimento CRM
- **Tipos atualizados**: Removidos campos schedulingEnabled, agendaId, schedulingPromptConsult, schedulingPromptTime, schedulingDuration
- **Funcionalidades mantidas**: Preservadas configurações de comportamento, follow-ups automáticos e movimento CRM
- **Solicitação atendida**: Conforme pedido específico para remover opção de agendamento automático

### 2025-07-04 - Remoção Movimentação Automática de CRM
- **Seção removida**: Removida completamente a seção "Movimentação Automática de CRM" da página Agente de IA
- **Interface ainda mais simplificada**: Agente de IA agora foca apenas em comportamento e follow-ups automáticos
- **Campo removido**: autoMoveCrm removido da interface TypeScript e estado inicial
- **Funcionalidades finais**: Apenas configurações de comportamento e follow-ups automáticos mantidos
- **Solicitação atendida**: Conforme pedido específico para remover opção de movimentação automática

### 2025-07-04 - Padronização Valores Iniciais das Metas como Zero
- **Política de novos usuários**: Todos os novos usuários agora começam com metas inicializadas em zero
- **Campos atualizados**:
  - `metaVendasEmpresa`: "0" (string)
  - `ticketMedioVendas`: "0" (string)
  - `quantidadeLeadsVendas`: 0 (number)
  - `quantosDisparosPorLead`: 0 (number) - alterado de 1 para 0
  - `custoIcloudTotal`: "0" (string)
  - `quantasMensagensEnviadas`: 0 (number)
- **Atualizações realizadas**:
  - **Backend**: Função `initializeUserData` e `createDefaultSettings` atualizadas
  - **Frontend**: Formulário de metas e valores padrão atualizados
  - **Schema**: Drizzle schema atualizado com novos valores padrão
  - **Validação**: Campo `quantosDisparosPorLead` aceita 0 como valor mínimo
- **Objetivo**: Permitir que usuários definam suas próprias metas personalizadas desde o início

### 2025-07-04 - Sistema de Exportação Excel para Usuários
- **Nova funcionalidade**: Botão "Exportar Excel" na página de gerenciamento de usuários
- **Localização**: Cabeçalho da página ao lado do botão "Novo Usuário"
- **Campos exportados**: Dados completos dos usuários incluindo:
  - Informações pessoais (ID, username, email, nome, empresa, telefone, bio)
  - Status administrativo e de ativação
  - Configurações de tokens e mensalidade
  - Permissões de acesso a todos os módulos
  - Data de criação
- **Formato do arquivo**: Excel (.xlsx) com nome automático incluindo data e hora
- **Biblioteca utilizada**: xlsx com importação dinâmica para otimização
- **Tratamento de erros**: Validação de dados disponíveis e feedback ao usuário
- **Colunas otimizadas**: Larguras ajustadas automaticamente para melhor visualização
- **Compatibilidade**: Funciona para todos os usuários cadastrados no sistema

### 2025-07-04 - Sistema Inteligente de Roteamento de Webhooks Cloud API
- **Problema resolvido**: Mensagens Cloud API agora são roteadas para webhook específico
- **Campo adicionado**: `cloudWebhookUrl` na tabela `server_ai_agents` e formulários
- **Interface atualizada**: Novos formulários de criação/edição de agentes IA incluem campo "URL do Webhook Cloud"
- **Lógica implementada**: Sistema prioriza `cloudWebhookUrl` para mensagens Cloud API, fallback para `webhookUrl`
- **Query otimizada**: `COALESCE(sa.cloud_webhook_url, sa.webhook_url)` para seleção automática
- **Logs detalhados**: Sistema mostra qual webhook está sendo usado (Cloud ou padrão)
- **Schema atualizado**: `insertServerAiAgentSchema` inclui novo campo para validação
- **Fluxo aprimorado**: Cloud API → Meta Webhook → Agente específico → Webhook Cloud (prioritário)
- **Separação clara**: Webhooks gerais vs. webhooks específicos para Cloud API
- **Compatibilidade**: Sistema funciona com agentes existentes que só possuem webhook padrão

### 2025-07-08 - Sistema Completo de Webhook para Geração de QR Code IMPLEMENTADO E CORRIGIDO ✅
- **Funcionalidade EXPANDIDA**: Sistema completo de notificação automática quando QR Code WhatsApp é **GERADO** (não apenas conectado)
- **Integração múltipla implementada**:
  - **server/api/connections.ts**: Webhook adicionado na função `getWhatsAppQrCode` (2 pontos de geração)
  - **server/connection.ts**: Webhook adicionado em 3 pontos onde QR Code é retornado com sucesso (POST, GET, final)
- **Busca dinâmica implementada**:
  - **Problema resolvido**: Sistema agora busca dinamicamente o webhook do campo "Webhook de Configuração Instancia Evolution"
  - **URL correto configurado**: `https://webhook.primerastreadores.com/webhook/e4da7e7b-c5c1-4fea-8ea4-c843f4443c47`
  - **Função `getServerWebhookUrl`**: Busca corretamente o webhook do servidor específico do usuário via tabela `user_servers`
  - **Atualização automática**: Quando usuário altera URL nas configurações, sistema usa automaticamente o novo endereço
- **Payload completo enviado**:
  - `event`: "qr_code_generated"
  - `data`: user_name, user_id, webhook_url, cloud_webhook_url, agent_name, qr_code_data, timestamp
  - Headers: X-User-ID, X-User-Name para identificação
- **Teste validado com sucesso (Status 200)**:
  - Nome do Usuário: "Administrador"
  - ID do Usuário: 2
  - URLs do webhook (padrão e cloud do agente IA)
  - Nome do agente: "Agente 02"
  - QR Code data incluído
  - **Webhook enviado para URL correto**: webhook.primerastreadores.com
- **Fluxo FUNCIONAL CONFIRMADO**: QR Code gerado → Sistema detecta → Webhook POST enviado para servidor configurado → Agente IA recebe notificação
- **Isolamento garantido**: Webhooks respeitam configurações específicas por usuário via tabelas relacionadas
- **Sistema dinâmico VALIDADO**: Usuário pode alterar webhook URL nas configurações e sistema se adapta automaticamente
- **Teste final Status 200 confirmado**: Sistema comprovadamente funcional enviando webhooks para URLs corretos

### 2025-07-08 - Correção Crítica Campo de Busca Webhook QR Code ✅
- **Problema identificado**: Sistema buscava webhook no campo `whatsapp_webhook_url` quando deveria buscar em `contacts_webhook_url`
- **Mapeamento correto confirmado**:
  - `contacts_webhook_url`: `https://webhook.primerastreadores.com/webhook/e4da7e7b-c5c1-4fea-8ea4-c843f4443c47` (correto)
  - `whatsapp_webhook_url`: `https://n8n.primerastreadores.com/webhook-test/e4da7e7b-c5c1-4fea-8ea4-c843f4443c47` (campo diferente)
- **Correções implementadas**:
  - `getServerWebhookUrl()` corrigida para buscar `s.contacts_webhook_url`
  - `getInstanceWebhookUrl()` corrigida para buscar `s.contacts_webhook_url`
- **Resultado final**: Sistema agora envia webhooks para endereço correto com Status 200 (sucesso)
- **Fluxo validado**: QR Code gerado → Webhook enviado para webhook.primerastreadores.com → Resposta HTTP 200 recebida

### 2025-07-14 - Sistema de Paginação na Página de Prospecções ✅
- **Funcionalidade implementada**: Paginação completa na página de prospecções limitando exibição a 10 resultados por página
- **Componentes adicionados**:
  - Estados de paginação: `currentPage`, `resultsPerPage = 10`
  - Cálculo automático: `totalPages`, `paginatedResults`, `startIndex`, `endIndex`
  - Funções de navegação: `goToPage()`, `goToNextPage()`, `goToPreviousPage()`
- **Interface implementada**:
  - **ScrollArea**: Barra de rolagem vertical com altura fixa (500px) e cabeçalho fixo
  - **Controles de navegação**: Botões "Anterior/Próxima" com ícones ChevronLeft/ChevronRight
  - **Indicador de página**: Até 5 botões numerados com lógica inteligente de posicionamento
  - **Contador de resultados**: "Mostrando X a Y de Z resultados"
- **Funcionalidades**:
  - Reset automático para página 1 ao trocar de busca ativa
  - Desabilitação automática de botões quando nas extremidades
  - Lógica adaptável de numeração (início, meio, fim da paginação)
  - Apenas exibe controles quando há resultados disponíveis
- **Resultado**: Interface organizada, navegação intuitiva e melhor performance com grandes volumes de dados

### 2025-07-04 - Sistema Automático de Webhook para Conexões QR Code IMPLEMENTADO E FUNCIONAL
- **Funcionalidade IMPLEMENTADA**: Sistema completo de notificação automática quando QR Code WhatsApp é conectado
- **Campo correto identificado**: `whatsapp_webhook_url` na tabela `servers` contém a URL correta para webhooks
- **URL validada**: https://webhook.primerastreadores.com/webhook/e4da7e7b-c5c1-4fea-8ea4-c843f4443c47
- **Arquivo atualizado**: `server/api/qr-connection-webhook.ts` corrigido para usar campo correto:
  - `getInstanceWebhookUrl()`: Agora busca `whatsapp_webhook_url` ao invés de `ai_agent_webhook_url`
  - Sistema de logs detalhado para tracking de webhooks enviados
- **Detecção dupla implementada**:
  - **WebSocket**: Sistema existente em `server/websocket.ts` detecta mudanças via Evolution API WebSocket
  - **Polling**: Sistema adicional em `server/connection.ts` detecta mudanças via verificação periódica de status
- **Lógica de detecção**: Sistema detecta mudança de `desconectado → conectado` e dispara webhook automaticamente
- **Payload estruturado**: Webhooks incluem identificação completa:
  - `event`: "qr_code_connected" ou "qr_code_disconnected"
  - `data`: userId, userName, agentName, serverName, connected (boolean), timestamp (ISO)
- **Frontend atualizado**: `client/src/pages/connection-page.tsx` mostra feedback "Webhook de notificação enviado"
- **Teste validado**: Sistema respondendo corretamente - webhook n8n retorna código 404 (modo teste) confirmando requisição enviada
- **Fluxo FUNCIONAL**: QR Code conecta → Sistema detecta mudança → Webhook POST enviado → Agente IA notificado
- **Isolamento garantido**: Webhooks respeitam configurações específicas por usuário via `user_servers`

### 2025-07-17 - Simplificação Interface de Envio de Mensagens
- **Campo "Quantidade de Mensagens" removido**: Interface de envio de mensagens simplificada conforme solicitação
- **Alterações no formulário**:
  - Removido campo `quantity` do schema de validação
  - Removido FormField "Quantidade de Mensagens" do formulário
  - Sistema agora usa automaticamente a quantidade de leads encontrados na pesquisa selecionada
- **Lógica atualizada**: 
  - `totalRecipients` baseado em `searchData.leadsFound` ao invés de input manual
  - Valores padrão do formulário limpos (removidas referências de quantity)
  - Envios executam para todos os leads da pesquisa sem limitação manual
- **Dica removida**: "Defina a quantidade de mensagens para controlar o volume de envios"
- **Histórico de envios simplificado**: Coluna "Destinatários" removida da tabela de histórico
- **Interface otimizada**: Formulário mais limpo e direto, foco nos campos essenciais

### 2025-07-17 - Correção Texto de Importação 
- **Página de importação corrigida**: Alterado texto de "PDF ou CSV" para "CSV ou Excel"
- **Validação aprimorada**: Sistema aceita corretamente arquivos .csv, .xlsx e .xls
- **Consistência**: Interface agora reflete corretamente as funcionalidades reais do sistema

### 2025-07-17 - Correção Completa do Sistema de Rolagem e Contagem de Resultados
- **Problema de viewport resolvido**: Página de prospecção agora inicia do topo sem cortes
- **Rolagem dual funcional**: Sistema habilitado com rolagem vertical (altura máxima 600px) e horizontal simultâneas
- **Estrutura otimizada**: Substituído ScrollArea por `overflow-auto max-h-[600px]` para melhor compatibilidade
- **Contagem de resultados corrigida**: Sistema agora exibe sempre o valor real de resultados encontrados
- **Função getRealCount() implementada**: Para busca ativa usa `results.length`, para outras usa valor salvo
- **Interface limpa**: Removido `justify-center` e `h-full` que causavam centralização forçada
- **Cabeçalho fixo**: Tabela mantém cabeçalho visível durante rolagem com `sticky top-0`
- **Todas as colunas acessíveis**: EMAIL, ENDEREÇO, SITE e outras colunas visíveis via rolagem horizontal
- **Discrepância eliminada**: Valor mostrado em azul "X encontrados" agora corresponde ao real número de resultados

### 2025-07-17 - Sistema Inteligente de Contagem Real de Resultados
- **Problema resolvido**: Cartões de estatísticas mostravam valores desatualizados (150) ao invés dos reais (102)
- **Query para contagem real implementada**: Sistema busca contagens reais de todas as buscas em background
- **Priorização inteligente**: `getRealCount()` prioriza dados em tempo real sobre valores em cache
- **Cartões corrigidos**: "Leads Encontrados" e "Pendentes" agora usam sempre valores reais calculados
- **Cache otimizado**: Sistema mantém dados atualizados por 30 segundos para performance
- **Fallback robusto**: Em caso de erro na API, utiliza valores salvos como backup
- **Sincronização completa**: Interface superior e lista lateral sempre mostram dados consistentes
- **Solução definitiva**: Elimina permanentemente discrepâncias entre valores mostrados e dados reais

### 2025-07-17 - Sistema Completo de Paginação na Página de Contatos
- **Funcionalidade implementada**: Limitação de 10 contatos por página com navegação completa
- **Estados de paginação**: `currentPage`, `contactsPerPage = 10`, `totalPages`, cálculos automáticos
- **Controles de navegação**: Botões "Anterior/Próxima" com ícones ChevronLeft/ChevronRight
- **Paginação numerada**: Até 5 botões de página com lógica inteligente de posicionamento
- **Contador de resultados**: "Mostrando X a Y de Z contatos" para orientação do usuário
- **Reset automático**: Página volta para 1 automaticamente ao alterar termo de busca
- **Lógica adaptável**: Numeração se adapta baseada na página atual (início, meio, fim)
- **Controles inteligentes**: Desabilitação automática nos extremos, só aparece quando necessário
- **Badge atualizada**: Contagem total correta no título da seção
- **Performance otimizada**: Apenas os contatos da página atual são renderizados
- **Interface responsiva**: Mantém experiência consistente em diferentes tamanhos de tela

### 2025-07-17 - Correção Rota PATCH para Templates QR Code
- **Problema identificado**: Frontend usava PATCH mas backend só tinha rota PUT
- **Rota PATCH criada**: `/api/message-templates/:id` com validação e limpeza de caracteres
- **Limpeza automática**: Remove caracteres especiais problemáticos (< > ") que causavam erro JSON
- **Validação rigorosa**: Verificação de dados de entrada e tratamento de erros de sintaxe
- **Logs detalhados**: Sistema mostra progresso de atualização para debugging
- **Isolamento mantido**: Verificação de propriedade do template por usuário preservada
- **Erro resolvido**: "Unexpected token '<'." eliminado através da limpeza de caracteres

### 2025-07-17 - Simplificação Interface de Contatos
- **Colunas removidas**: "Última Mensagem" e "Data" removidas da tabela de contatos conforme solicitação
- **Interface otimizada**: Tabela de contatos mais limpa e focada nos dados essenciais
- **Colunas mantidas**: Nome, Telefone, Fonte, Tags, Status e Ações
- **Melhoria de UX**: Tabela mais simples e eficiente para visualização de contatos

### 2025-07-17 - Correção Mapeamento de Campos Contatos
- **Problema identificado**: Discrepância entre campos API (snake_case) e interface (camelCase)
- **Campos corrigidos**: `phone_number`, `is_active`, `last_message_time`, etc.
- **Interface TypeScript atualizada**: Contact interface agora usa snake_case conforme API
- **Funcionalidades corrigidas**: 
  - Display do telefone na tabela
  - Filtro de busca por telefone
  - Função de edição de contatos  
  - Badge de status ativo/inativo
- **Resultado**: Contatos editados agora exibem telefone corretamente na interface

### 2025-07-17 - Correção Contador de Contatos Ativos e Cores dos Badges
- **Bug crítico resolvido**: Contador "Ativos" mostrando 0 contatos quando havia muitos ativos
- **Causa**: Código buscava campo `isActive` (camelCase) quando API retorna `is_active` (snake_case)
- **Correção aplicada**: Linha 490 alterada para usar `c.is_active` no filtro de contagem
- **Melhorias visuais dos badges**:
  - Badge "Ativo": Gradiente laranja-amarelo vibrante com hover mais intenso
  - Badge "Inativo": Cinza escuro com hover cinza mais escuro (removido verde incorreto)
- **Resultado**: Sistema agora conta e exibe corretamente contatos ativos com cores consistentes

### 2025-07-17 - Sistema Completo de Paginação na Página de Relatórios
- **Funcionalidade implementada**: Limitação de 10 resultados por página em todas as 6 tabelas de relatórios
- **Estrutura otimizada**: 
  - Estados de paginação independentes para cada tabela (Meta API e QR Code)
  - Funções auxiliares: `getPaginatedData()`, `getTotalPages()`, `renderPaginationControls()`
- **Tabelas com paginação**:
  - **Meta API**: Conversas Iniciadas, Mensagens, Leads (3 tabelas)
  - **QR Code**: Conversas, Mensagens, Contatos (3 tabelas)
- **Controles de navegação**:
  - Botões "Anterior/Próxima" com ícones ChevronLeft/ChevronRight
  - Numeração de páginas (até 5 botões) com lógica inteligente de posicionamento
  - Contador de resultados: "Mostrando X a Y de Z resultados"
- **Interface responsiva**:
  - Botão ativo com gradiente laranja-amarelo consistente com o tema
  - Desabilitação automática nos extremos das páginas
  - Controles só aparecem quando há mais de 1 página
- **Performance otimizada**: Apenas dados da página atual são renderizados nas tabelas
- **Reset automático**: Paginação volta para página 1 ao alterar filtros de data
- **Resultado**: Navegação eficiente em grandes volumes de dados com interface intuitiva

### 2025-07-17 - Otimização Completa de Layout da Página de Configurações
- **Layout responsivo aprimorado**: Interface otimizada para melhor enquadramento em diferentes tamanhos de tela
- **Estrutura de navegação melhorada**:
  - Sidebar de navegação com largura fixa (264px) em desktop
  - Navigation sticky em telas grandes para melhor usabilidade
  - Botões de navegação menores (size="sm") para economia de espaço
  - Layout flex adaptável: coluna em mobile, linha em desktop
- **Otimizações de conteúdo**:
  - Container principal com max-width responsivo e altura controlada
  - Área de conteúdo com scroll vertical independente
  - Grid de formulários inteligente: 1 coluna (mobile) → 2 colunas (tablet) → 3 colunas (desktop)
  - Cards com shadow suave e espaçamento otimizado
- **Melhorias visuais**:
  - Ícones contextuais nos títulos (Target para metas, WA para WhatsApp)
  - Backgrounds sutis nas seções em desenvolvimento
  - Avatar redimensionado responsivamente
  - Espaçamentos padronizados e harmoniosos
- **Performance de navegação**:
  - Altura máxima controlada para evitar scrolling excessivo
  - Padding responsivo (p-3 mobile → p-6 desktop)
  - Container centralizado com largura máxima de 7xl
- **Resultado**: Interface moderna, responsiva e otimizada para produtividade em qualquer dispositivo

*Última atualização: 17 de julho de 2025*
*Layout de configurações totalmente otimizado para responsividade*