<?php
/**
 * Zabbix API PHP Proxy
 * Este script esconde o IP real do seu Zabbix e os dados de login (Token).
 * Ele recebe a requisição (method e params) do seu Front-End, adiciona o token
 * secretamente e repassa a requisição para o Zabbix real, devolvendo a resposta.
 */

// Permite requisições de qualquer origem (se você quiser restringir, mude o '*')
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

// Trata a requisição OPTIONS (Preflight do CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ---------------------------------------------------------
// CONFIGURACÕES DE SEGURANÇA (FIXE SEUS DADOS AQUI)
// ---------------------------------------------------------
$ZABBIX_URL = 'http://[SUA-API]/zabbix/api_jsonrpc.php';

// Substitua 'SEU_TOKEN_AQUI' pelo token gerado no Zabbix 
// (Administração -> Usuários -> Tokens de API)
$ZABBIX_API_TOKEN = 'SEU TOKEN';

// Opcional: Se for usar SSL não assinado na rede interna, desative a verificação
$VERIFY_SSL = false;

// ---------------------------------------------------------

// Recebe o corpo da requisição do Front-End (em JSON)
$inputJSON = file_get_contents('php://input');
$requestData = json_decode($inputJSON, true);

if (!$requestData) {
    http_response_code(400);
    echo json_encode(['error' => 'Payload JSON Inválido']);
    exit();
}

// Injeção Secreta de Segurança
// Adiciona o Token de Autorização apenas internamente, se não for requisição de login.
if (isset($requestData['method']) && $requestData['method'] !== 'user.login') {
    $requestData['auth'] = $ZABBIX_API_TOKEN;
}

// Prepara os dados para enviar ao Zabbix real
$payload = json_encode($requestData);

$ch = curl_init($ZABBIX_URL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json-rpc'
]);

if (!$VERIFY_SSL) {
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
}

// Executa a requisição contra o Zabbix real
$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($response === false) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Falha de comunicação com o servidor Zabbix interno',
        'details' => $error
    ]);
    exit();
}

// Retorna a resposta do Zabbix de volta ao Front-End
http_response_code($httpcode);
echo $response;
?>
