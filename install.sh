#!/bin/bash

# ==============================================================================
# Script de Instalação Automática - Analist Dashboard (Nativo Apache + PHP)
# ==============================================================================
# Execute no terminal com permissões de root: 
# curl -sSL https://raw.githubusercontent.com/.../install.sh | sudo bash
# ==============================================================================

# Cores para o output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}[*] Iniciando a instalação nativa do Analist Dashboard...${NC}"

# 1. Verifica se está rodando como root
if [ "$EUID" -ne 0 ]; then
  echo "Por favor, execute este script como root (sudo)."
  exit 1
fi

# 2. Identifica o sistema e instala Apache + PHP e Git
echo -e "${BLUE}[*] Instalando dependências (Apache, PHP, Git, cURL)...${NC}"
if [ -f /etc/debian_version ]; then
    apt-get update -y
    apt-get install -y apache2 php libapache2-mod-php git curl php-curl
    WEB_USER="www-data"
    APACHE_SERVICE="apache2"
elif [ -f /etc/redhat-release ]; then
    yum install -y httpd php git curl php-curl
    WEB_USER="apache"
    APACHE_SERVICE="httpd"
else
    echo "Sistema operacional não suportado automaticamente por este script."
    exit 1
fi

# 3. Cria o diretório e baixa os arquivos do GitHub
APP_DIR="/var/www/analist"
REPO_URL="https://github.com/LucasGonMoreira/PainelGeral-Monitoramento.git" # <-- Altere aqui futuramente

echo -e "${BLUE}[*] Clonando os arquivos do Dashboard...${NC}"
rm -rf $APP_DIR
git clone $REPO_URL $APP_DIR
# Se não for usar git clone, você pode usar comandos curl/wget para baixar os arquivos

# 4. Ajusta permissões
chown -R $WEB_USER:$WEB_USER $APP_DIR
chmod -R 755 $APP_DIR

# 5. Configura o Apache para rodar na porta 3001
echo -e "${BLUE}[*] Configurando o Apache para a porta 3001...${NC}"

if [ -f /etc/debian_version ]; then
    # Adiciona a porta 3001 no ports.conf se não existir
    grep -q "Listen 3001" /etc/apache2/ports.conf || echo "Listen 3001" >> /etc/apache2/ports.conf
    
    # Cria o VirtualHost
    cat <<EOF > /etc/apache2/sites-available/analist.conf
<VirtualHost *:3001>
    DocumentRoot $APP_DIR
    <Directory $APP_DIR>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
EOF
    a2ensite analist.conf
elif [ -f /etc/redhat-release ]; then
    # Adiciona a porta 3001 no httpd.conf
    grep -q "Listen 3001" /etc/httpd/conf/httpd.conf || sed -i '/Listen 80/a Listen 3001' /etc/httpd/conf/httpd.conf
    
    cat <<EOF > /etc/httpd/conf.d/analist.conf
<VirtualHost *:3001>
    DocumentRoot $APP_DIR
    <Directory $APP_DIR>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
EOF
fi

# 6. Reinicia o servidor Web
echo -e "${BLUE}[*] Reiniciando o servidor Web...${NC}"
systemctl enable $APACHE_SERVICE
systemctl restart $APACHE_SERVICE

echo -e "${GREEN}[✔] Instalação concluída com sucesso!${NC}"
echo -e "${GREEN}Acesse seu novo dashboard através de: http://$(hostname -I | awk '{print $1}'):3001${NC}"
