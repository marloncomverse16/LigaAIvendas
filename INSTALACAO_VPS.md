# 🚀 Guia de Instalação do LigAI Dashboard no VPS

## 📋 Versão 4.0 - Download Automático do GitHub

### ✨ Novidades da Versão 4.0

- **✅ Download Automático**: Baixa código do GitHub automaticamente
- **✅ Repositório Oficial**: https://github.com/marloncomverse16/LigaAIvendas
- **✅ Fallback Inteligente**: Cria aplicação básica se GitHub não acessível
- **✅ Detecção de Banco Existente**: Verifica bancos PostgreSQL existentes
- **✅ Opções Flexíveis**: Usar banco existente ou criar novo
- **✅ Validação de Credenciais**: Testa conexão antes de prosseguir
- **✅ SSL Automático**: Configuração opcional do Let's Encrypt
- **✅ Sintaxe Bash Corrigida**: Todos os erros de sintaxe resolvidos
- **✅ Migrações Automáticas**: Executa db:push automaticamente

### 🛠️ Requisitos do Sistema

- **Sistema Operacional**: Ubuntu 20.04+ ou Debian 11+
- **Acesso**: Root (sudo)
- **Memória**: Mínimo 1GB RAM
- **Espaço**: 5GB livres
- **Internet**: Conexão estável

### 📱 Instalação Passo a Passo

#### 1. Preparar o Servidor

```bash
# Conectar ao VPS via SSH
ssh root@seu-servidor.com

# Baixar o script (copie o arquivo install-ligai-final.sh)
wget https://seu-servidor.com/install-ligai-final.sh
# ou copie manualmente o arquivo

# Dar permissão de execução
chmod +x install-ligai-final.sh
```

#### 2. Executar a Instalação

```bash
# Usar a versão final corrigida (recomendado)
chmod +x install-ligai-final-v4.sh
sudo ./install-ligai-final-v4.sh

# Ou a versão com detecção avançada
chmod +x install-ligai-v4.sh
sudo ./install-ligai-v4.sh
```

### 🛠️ **Correções v4.0 Final:**

- **✅ PostgreSQL Simplificado**: Sem travamentos na verificação de bancos
- **✅ Timeouts Inteligentes**: Todas as operações têm timeout de segurança  
- **✅ Fallback Robusto**: Aplicação básica se GitHub não acessível
- **✅ Diagnóstico Melhorado**: Logs detalhados para troubleshooting
- **✅ Download Garantido**: Clone Git + ZIP + fallback local

#### 3. Configurações Solicitadas

O script irá perguntar:

**Configurações Básicas:**
- Domínio da aplicação (ex: meusite.com)
- Porta da aplicação (padrão: 5000)

**Banco de Dados:**
- Nome do banco (padrão: ligai)
- Usuário do banco (padrão: ligai)
- Senha do banco (padrão: ligai123)

**Sistema:**
- Usuário do sistema (padrão: ligai)
- Diretório de instalação (padrão: /opt/ligai)

**SSL (Opcional):**
- Configurar HTTPS automático (s/N)
- Email para certificado SSL

#### 4. Detecção de Banco Existente

Se o script detectar bancos PostgreSQL existentes, você terá 3 opções:

1. **Usar banco existente**: Fornecer credenciais do banco atual
2. **Excluir e criar novo**: Remove o banco e cria uma configuração limpa
3. **Cancelar instalação**: Interrompe o processo

### 🎯 Funcionalidades Implementadas

#### Interface do Dashboard
- ✅ Status em tempo real dos serviços
- ✅ Informações de sistema e uptime
- ✅ Health checks automáticos
- ✅ Interface responsiva
- ✅ Recursos disponíveis listados

#### Arquitetura Técnica
- ✅ Backend Express.js com TypeScript
- ✅ Frontend React com Tailwind CSS
- ✅ PostgreSQL com configuração segura
- ✅ Nginx como proxy reverso
- ✅ Serviços systemd configurados

#### Segurança
- ✅ Headers de segurança configurados
- ✅ SSL/HTTPS opcional
- ✅ Usuário dedicado para aplicação
- ✅ Permissões restritivas
- ✅ Configurações de firewall

### 📊 URLs de Acesso

Após a instalação bem-sucedida:

- **🌐 Aplicação Principal**: `http://seu-dominio.com` (ou https se SSL configurado)
- **🔍 Health Check**: `http://seu-dominio.com/api/health`
- **📋 Informações**: `http://seu-dominio.com/api/info`

### 🔧 Comandos Úteis

```bash
# Ver status dos serviços
sudo systemctl status ligai
sudo systemctl status nginx
sudo systemctl status postgresql

# Ver logs em tempo real
sudo journalctl -u ligai -f

# Reiniciar aplicação
sudo systemctl restart ligai

# Verificar configuração do Nginx
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx
```

### 🛡️ Troubleshooting

#### Problema: Erro de sintaxe PostgreSQL
**Solução**: Use a versão 3.0 do script com sintaxe corrigida

#### Problema: Banco já existe
**Solução**: O script detecta automaticamente e oferece opções

#### Problema: Falha na conexão
**Solução**: Verifique credenciais fornecidas e conectividade

#### Problema: Porta ocupada
**Solução**: O script libera portas automaticamente

### 📁 Estrutura de Arquivos

```
/opt/ligai/
├── client/              # Frontend React
│   ├── src/
│   ├── dist/           # Build de produção
│   └── index.html
├── server/             # Backend Express
│   └── index.ts
├── shared/             # Código compartilhado
├── uploads/            # Arquivos enviados
├── .env               # Variáveis de ambiente
├── package.json       # Dependências
└── README.md         # Documentação
```

### 🔄 Atualizações

Para atualizar o sistema:

```bash
cd /opt/ligai
sudo systemctl stop ligai
git pull origin main  # se usando Git
npm install
npm run build
sudo systemctl start ligai
```

### 💾 Backup

Faça backup dos seguintes itens:

```bash
# Banco de dados
pg_dump ligai > backup_ligai.sql

# Arquivos da aplicação
tar -czf backup_ligai_files.tar.gz /opt/ligai

# Configurações do Nginx
cp /etc/nginx/sites-available/ligai backup_nginx_ligai.conf
```

### 📞 Suporte

- 📖 Documentação completa em `/opt/ligai/README.md`
- 🔍 Logs detalhados: `sudo journalctl -u ligai -n 100`
- 🌐 Status da aplicação: `http://seu-dominio.com/api/health`

---

## 🎉 Instalação Concluída!

Após seguir este guia, você terá um **LigAI Dashboard completo e funcional** rodando no seu VPS com:

- ✅ Aplicação web moderna
- ✅ Banco de dados PostgreSQL
- ✅ Proxy reverso Nginx
- ✅ SSL automático (opcional)
- ✅ Monitoramento em tempo real
- ✅ Serviços gerenciados pelo sistema

**Acesse seu domínio e comece a usar o LigAI Dashboard!** 🚀