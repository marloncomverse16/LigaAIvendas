# 🚀 LigAI Dashboard - Guia de Instalação em VPS

Este guia contém instruções completas para instalar o LigAI Dashboard em uma VPS (Virtual Private Server) com Ubuntu ou Debian.

## 📋 Pré-requisitos

### Servidor VPS
- **Sistema Operacional**: Ubuntu 20.04+ ou Debian 11+
- **RAM**: Mínimo 2GB (recomendado 4GB+)
- **CPU**: Mínimo 1 core (recomendado 2+ cores)
- **Armazenamento**: Mínimo 20GB SSD
- **Acesso**: SSH com usuário não-root com privilégios sudo

### Domínio/DNS
- Domínio ou subdomínio configurado apontando para o IP da VPS
- Acesso para configurar registros DNS (A record)

### Informações Necessárias
Tenha em mãos:
- Domínio ou subdomínio (ex: `ligai.meudominio.com`)
- Email válido para certificado SSL
- Credenciais do banco de dados (nome, usuário, senha)

## 🔧 Instalação Automática

### Passo 1: Download dos Scripts

```bash
# Conectar via SSH à sua VPS
ssh usuario@seu-servidor.com

# Baixar os scripts de instalação
wget https://raw.githubusercontent.com/seu-repo/ligai-dashboard/main/install-ligai.sh
wget https://raw.githubusercontent.com/seu-repo/ligai-dashboard/main/setup-production.sh
wget https://raw.githubusercontent.com/seu-repo/ligai-dashboard/main/update-ligai.sh

# Dar permissão de execução
chmod +x install-ligai.sh setup-production.sh update-ligai.sh
```

### Passo 2: Executar Instalação Principal

```bash
# Executar o instalador principal
./install-ligai.sh
```

O script solicitará as seguintes informações:
1. **Domínio/Subdomínio**: `ligai.meudominio.com`
2. **Email para SSL**: Seu email para o certificado Let's Encrypt
3. **Nome do banco**: Nome do banco PostgreSQL (padrão: `ligai`)
4. **Usuário do banco**: Usuário PostgreSQL (padrão: `ligai_user`)
5. **Senha do banco**: Senha segura para o banco
6. **Porta da aplicação**: Porta interna (padrão: `5000`)
7. **Pasta de instalação**: Diretório da aplicação (padrão: `/home/usuario/ligai`)

### Passo 3: Aplicar Otimizações de Produção

```bash
# Executar otimizações (após instalação principal)
./setup-production.sh
```

### Passo 4: Reiniciar o Servidor

```bash
# Reiniciar para aplicar todas as configurações
sudo reboot
```

## 🔍 Verificação da Instalação

Após a reinicialização, verifique se tudo está funcionando:

```bash
# Verificar status geral
ligai-status

# Verificar logs da aplicação
ligai-logs

# Verificar serviços
sudo systemctl status ligai nginx postgresql
```

## 🌐 Acessar a Aplicação

1. Abra seu navegador
2. Acesse: `https://seu-dominio.com`
3. Crie sua conta de administrador
4. Configure suas integrações WhatsApp

## 📂 Estrutura de Arquivos

```
/home/usuario/ligai/          # Aplicação principal
├── client/                   # Frontend React
├── server/                   # Backend Express
├── shared/                   # Código compartilhado
├── uploads/                  # Arquivos enviados
├── .env                      # Configurações
└── package.json              # Dependências

/etc/nginx/sites-available/   # Configuração Nginx
/etc/systemd/system/ligai.service  # Serviço systemd
/var/log/ligai/              # Logs da aplicação
~/backups/ligai/             # Backups automáticos
```

## 🛠️ Comandos Úteis

### Gerenciamento da Aplicação
```bash
# Status do sistema
ligai-status

# Ver logs em tempo real
ligai-logs

# Reiniciar aplicação
ligai-restart

# Parar aplicação
ligai-stop

# Iniciar aplicação
ligai-start
```

### Gerenciamento do Nginx
```bash
# Recarregar configuração
nginx-reload

# Status do Nginx
sudo systemctl status nginx

# Testar configuração
sudo nginx -t
```

### Banco de Dados
```bash
# Backup do banco
db-backup

# Conectar ao banco
sudo -u postgres psql ligai

# Ver logs do PostgreSQL
sudo journalctl -u postgresql -f
```

### Manutenção
```bash
# Manutenção manual
~/maintenance-ligai.sh

# Backup manual
~/backup-ligai.sh

# Ver espaço em disco
df -h

# Ver uso de memória
free -h
```

## 🔒 Configurações de Segurança

### Firewall (UFW)
```bash
# Status do firewall
sudo ufw status

# Permitir nova porta (se necessário)
sudo ufw allow 8080
```

### Fail2ban
```bash
# Status do Fail2ban
sudo fail2ban-client status

# Ver IPs banidos
sudo fail2ban-client status sshd
```

### SSL/HTTPS
```bash
# Renovar certificado manualmente
sudo certbot renew

# Verificar certificados
sudo certbot certificates

# Testar renovação
sudo certbot renew --dry-run
```

## 📊 Monitoramento

### Logs Importantes
- **Aplicação**: `journalctl -u ligai -f`
- **Nginx**: `sudo tail -f /var/log/nginx/error.log`
- **PostgreSQL**: `sudo journalctl -u postgresql -f`
- **Sistema**: `sudo journalctl -f`

### Métricas do Sistema
```bash
# CPU e memória
htop

# Uso de rede
nethogs

# I/O de disco
iotop
```

## 🔧 Solução de Problemas

### Aplicação não inicia
```bash
# Verificar logs
ligai-logs

# Verificar arquivo .env
cat ~/ligai/.env

# Testar conexão com banco
sudo -u postgres psql ligai -c "SELECT 1;"
```

### Problemas de SSL
```bash
# Verificar certificado
openssl x509 -in /etc/letsencrypt/live/seu-dominio.com/cert.pem -text -noout

# Renovar certificado
sudo certbot renew --force-renewal
```

### Problemas de DNS
```bash
# Verificar resolução DNS
nslookup seu-dominio.com

# Testar conectividade
curl -I https://seu-dominio.com
```

## 📱 Configuração WhatsApp

### Evolution API (QR Code)
1. Configure servidor Evolution API na interface
2. Obtenha QR Code para conexão
3. Escaneie com WhatsApp Business

### Meta Cloud API
1. Configure credenciais na interface
2. Verifique webhook URLs
3. Teste envio de mensagens

## 🔄 Atualizações do Sistema

### Atualização Automática (Recomendado)

Para atualizar sua instalação do LigAI Dashboard:

```bash
# Navegue até o diretório onde baixou os scripts
cd ~

# Execute o script de atualização
./update-ligai.sh
```

O script oferece um menu interativo com opções:

1. **Atualização Completa**: Atualiza código, dependências, executa migrações e testes
2. **Apenas Código**: Faz git pull da versão mais recente
3. **Apenas Dependências**: Atualiza bibliotecas npm
4. **Apenas Migrações**: Executa mudanças no banco de dados
5. **Apenas Build**: Reconstrói a aplicação
6. **Verificação de Saúde**: Verifica status sem alterar nada
7. **Rollback**: Volta para versão anterior em caso de problemas

### Atualização via Linha de Comando

```bash
# Atualização completa
./update-ligai.sh --full

# Apenas código
./update-ligai.sh --code

# Apenas dependências
./update-ligai.sh --deps

# Verificar saúde
./update-ligai.sh --health

# Rollback
./update-ligai.sh --rollback
```

### Funcionalidades de Segurança

- **Backup Automático**: Cria backup completo antes de qualquer atualização
- **Rollback Automático**: Em caso de erro, restaura versão anterior automaticamente
- **Verificação de Integridade**: Testa configurações antes de aplicar mudanças
- **Zero Downtime**: Minimiza tempo de inatividade durante atualizações

### Atualizações Manuais

Se preferir atualizar manualmente:

```bash
# 1. Parar aplicação
sudo systemctl stop ligai

# 2. Backup
cp -r ~/ligai ~/ligai_backup_$(date +%Y%m%d)

# 3. Atualizar código (se usando Git)
cd ~/ligai
git pull

# 4. Atualizar dependências
npm install

# 5. Executar migrações
npm run db:push

# 6. Build (se necessário)
npm run build

# 7. Iniciar aplicação
sudo systemctl start ligai
```

### Configuração de Atualizações Automáticas

Para receber atualizações automaticamente:

```bash
# Adicionar ao crontab para verificar atualizações semanalmente
(crontab -l 2>/dev/null; echo "0 4 * * 1 cd ~ && ./update-ligai.sh --code") | crontab -
```

## 📈 Otimizações Avançadas

### Para Alto Volume
Se você espera alto volume de mensagens:

1. **Aumentar recursos do servidor**:
   - 8GB+ RAM
   - 4+ CPU cores
   - SSD NVMe

2. **Otimizar PostgreSQL**:
   ```bash
   # Editar configuração
   sudo nano /etc/postgresql/*/main/postgresql.conf
   
   # Aumentar conexões
   max_connections = 500
   
   # Reiniciar PostgreSQL
   sudo systemctl restart postgresql
   ```

3. **Configurar Load Balancer** (para múltiplos servidores)

### Cache Redis (Opcional)
```bash
# Instalar Redis
sudo apt install redis-server

# Configurar no .env
echo "REDIS_URL=redis://localhost:6379" >> ~/ligai/.env
```

## 🆘 Suporte

### Logs para Suporte
Se precisar de ajuda, forneça os seguintes logs:

```bash
# Informações do sistema
ligai-status > ~/logs-suporte.txt

# Logs da aplicação
journalctl -u ligai -n 100 >> ~/logs-suporte.txt

# Configuração (sem senhas)
grep -v "PASSWORD\|SECRET\|TOKEN" ~/ligai/.env >> ~/logs-suporte.txt
```

### Contatos
- **Documentação**: https://github.com/seu-repo/ligai-dashboard
- **Suporte**: contato@ligai.com.br
- **Issues**: https://github.com/seu-repo/ligai-dashboard/issues

## 📋 Checklist Pós-Instalação

- [ ] Aplicação acessível via HTTPS
- [ ] Certificado SSL válido
- [ ] Banco de dados funcionando
- [ ] Conta de administrador criada
- [ ] Backup automático configurado
- [ ] Monitoramento ativo
- [ ] Firewall configurado
- [ ] DNS configurado corretamente
- [ ] WhatsApp configurado
- [ ] Teste de envio de mensagem realizado

---

## 🎉 Parabéns!

Sua instalação do LigAI Dashboard está completa! Agora você pode começar a gerenciar seus leads e automatizar suas comunicações WhatsApp.

**Dica**: Faça backups regulares e mantenha o sistema atualizado para melhor segurança e performance.