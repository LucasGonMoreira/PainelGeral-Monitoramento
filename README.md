# Painel Geral de Monitoramento - Zabbix

Um dashboard moderno, dinâmico e auto-configurável projetado para consumir a API do Zabbix. Este projeto transforma os dados brutos de monitoramento de infraestrutura (Servidores, POPs, Torres, Cidades e Switches) em uma visualização visualmente atraente, focada em NOCs (Network Operations Centers) e equipes de suporte.

## 🚀 Principais Funcionalidades

- **Autodescoberta por Host Groups**: O painel organiza automaticamente seus equipamentos por Cidades e Torres lendo a nomenclatura dos seus *Host Groups* no Zabbix (ex: `NomeDaCidade - NomeDaTorre`). Nenhuma configuração manual de interface é necessária!
- **Disponibilidade de Rede Precisa (30 Dias)**: Calcula e exibe a porcentagem exata de disponibilidade (SLA) do último mês diretamente dos eventos do Zabbix, focando apenas em incidentes classificados como **Desastre**.
- **Top Indisponibilidade**: Ao visualizar os detalhes de um host, o painel exibe o nome exato da *trigger* que mais causou tempo de inatividade naquele equipamento.
- **Métricas em Tempo Real**: Consome os dados (CPU, Memória, Disco, Voltagem, Temperatura, Uptime) instantaneamente via chamadas RPC.
- **Controle de Alertas (Acks)**: Interface de incidentes elegante com suporte a reconhecimento (*acknowledgments*) de alertas (exibindo `não_reconhecidos/reconhecidos ⚙️`).
- **Proxy PHP Seguro**: Toda a comunicação com a API do Zabbix é intermediada por um Proxy PHP nativo. A sua URL e o seu Token de Segurança (`Auth`) nunca são expostos no front-end.

---

## 🛠 Pré-Requisitos

Para rodar o painel de forma nativa em um servidor Linux (Ubuntu/Debian ou CentOS/RHEL), você precisa de:
- Apache 2 ou HTTPD
- PHP (versão 7.4 ou superior) com extensão `php-curl`
- Git

*(A instalação desses requisitos pode ser automatizada usando nosso script nativo abaixo).*

---

## ⚡ Como Instalar Rapidamente (One-Liner)

Se você estiver configurando um servidor Ubuntu/Debian vazio e quiser instalar o Apache, PHP e o Painel automaticamente na **porta 3001**, basta executar no terminal com permissões de `root` (ou usando `sudo`):

```bash
curl -sSL https://raw.githubusercontent.com/LucasGonMoreira/PainelGeral-Monitoramento/main/install.sh | sudo bash
```

Após o script terminar, o seu dashboard estará disponível em:
`http://[IP-DO-SEU-SERVIDOR]:3001`

---

## ⚙️ Configurando o Painel (Pós-Instalação)

Logo após clonar/instalar o repositório, você deve apontar o painel para o seu servidor Zabbix.

1. Acesse o arquivo `zabbix_proxy.php` no diretório do projeto (`/var/www/analist/` caso tenha usado o instalador).
2. Localize e altere as variáveis de segurança na linha 24 e 28:

```php
// Altere para a URL real da API do seu Zabbix
$ZABBIX_URL = 'http://[SUA-API]/zabbix/api_jsonrpc.php';

// Gere um token no Zabbix (Administração -> Usuários -> Tokens de API)
$ZABBIX_API_TOKEN = 'SEU_TOKEN_AQUI_1234567890';
```

### Regras de Organização no Zabbix (Crucial)

Para que a tela inicial gere as "Cidades" e "Torres" sem precisar programar nada, seus hosts no Zabbix devem estar inseridos em grupos que seguem a seguinte nomenclatura:

- Para agrupar uma Cidade e Torre: **`NomeDaCidade - NomeDaTorre`**
- Para identificar que é um Servidor Central (com CPU/RAM/Disco): Adicione o host a algum grupo que tenha **`Servidores`** no nome.
- Para identificar um POP (com Voltagem/Temperatura): Adicione a um grupo com o nome **`POP-PROTECT`**.

Os itens de coletas (chaves do Zabbix como `system.cpu.util`) podem ser customizados nas constantes `SERVER_METRICS_CONFIG` diretamente no arquivo `main.js`.

---

## 🔒 Segurança e Arquitetura

O Front-End (`main.js` e `index.html`) faz requisições Ajax exclusivas para o arquivo interno `./zabbix_proxy.php`. 
É este arquivo PHP (que roda do lado do servidor) que anexa a credencial de segurança e se comunica com o seu servidor Zabbix verdadeiro, garantindo que o seu token da API jamais trafegue ou apareça no console do navegador de quem está operando o NOC.

---

## 📄 Atualizações

Sempre que fizermos atualizações neste repositório, basta você entrar na sua pasta de instalação e puxar o código mais recente:
```bash
cd /var/www/analist/
sudo git pull
```
