#!/bin/bash

# ==============================================================================
# Script de Desinstalação - Analist Dashboard
# ==============================================================================

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${RED}[!] Iniciando a desinstalação do Analist Dashboard...${NC}"

# Verifica root
if [ "$EUID" -ne 0 ]; then
  echo "Por favor, execute este script como root (sudo)."
  exit 1
fi

APP_DIR="/var/www/analist"

# Remove arquivos
echo -e "${BLUE}[*] Removendo os arquivos do projeto em $APP_DIR...${NC}"
rm -rf $APP_DIR

# Identifica o sistema e remove configurações
if [ -f /etc/debian_version ]; then
    APACHE_SERVICE="apache2"
    
    echo -e "${BLUE}[*] Desativando o site no Apache...${NC}"
    a2dissite analist.conf 2>/dev/null
    rm -f /etc/apache2/sites-available/analist.conf
    
    # Remove a porta 3001 do ports.conf
    sed -i '/Listen 3001/d' /etc/apache2/ports.conf

elif [ -f /etc/redhat-release ]; then
    APACHE_SERVICE="httpd"
    
    echo -e "${BLUE}[*] Removendo VirtualHost do Apache...${NC}"
    rm -f /etc/httpd/conf.d/analist.conf
    
    # Remove a porta 3001 do httpd.conf
    sed -i '/Listen 3001/d' /etc/httpd/conf/httpd.conf
else
    echo "Sistema não suportado automaticamente para desinstalação."
    exit 1
fi

echo -e "${BLUE}[*] Reiniciando o Apache...${NC}"
systemctl restart $APACHE_SERVICE

echo -e "${GREEN}[✔] Desinstalação concluída com sucesso! Todos os arquivos e configurações foram removidos.${NC}"
