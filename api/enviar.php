<?php
/**
 * Projeto Gênesis — recebe o diagnóstico do site e envia os e-mails pelo SMTP do Titan.
 *
 * Segurança:
 *  - O navegador manda só as respostas. O laudo é recalculado aqui, a partir de dados.json
 *    (a mesma metodologia do site), e os dois e-mails são montados aqui. Nada de HTML vindo do navegador.
 *  - A equipe recebe o laudo completo. O visitante recebe só a temperatura e o próximo passo.
 *  - Validação de todos os campos, armadilha para robôs, tempo mínimo e limite de envios por IP.
 *  - A senha do SMTP fica em genesis-smtp.php, fora do public_html. Nunca no site.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function responder(int $status, array $corpo): void
{
    http_response_code($status);
    echo json_encode($corpo, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    responder(405, ['ok' => false, 'erro' => 'Use POST.']);
}

/* ---------- Configuração ---------- */

$configPaths = [
    dirname(__DIR__, 2) . '/genesis-smtp.php', // acima da pasta do site, ex.: /home2/USUARIO/genesis-smtp.php (recomendado)
    dirname(__DIR__) . '/genesis-smtp.php',    // na raiz do site, ao lado do index.html (bloqueado pelo .htaccess)
    __DIR__ . '/genesis-smtp.php',             // dentro de api/ (bloqueado pelo .htaccess)
];
$cfg = null;
foreach ($configPaths as $p) {
    if (is_file($p)) { $cfg = require $p; break; }
}
if (!is_array($cfg) || empty($cfg['smtp_pass']) || empty($cfg['smtp_user'])) {
    error_log('[genesis] genesis-smtp.php ausente ou incompleto');
    responder(503, ['ok' => false, 'erro' => 'Envio não configurado no servidor.']);
}
$cfg += [
    'smtp_host' => 'smtp.titan.email',
    'smtp_port' => 465,
    'from_email' => $cfg['smtp_user'],
    'from_name' => 'Projeto Gênesis',
    'team_to' => $cfg['smtp_user'],
    'allowed_hosts' => ['genesisintegrativa.com.br', 'www.genesisintegrativa.com.br'],
    'min_seconds' => 25, // o navegador espera 40 s; a folga cobre relógio do aparelho adiantado
    'max_per_ip_24h' => 3,
    'max_global_24h' => 60,
    'max_per_email_24h' => 2,
    'turnstile_secret' => '', // Cloudflare Turnstile: vazio = desligado
    'response_deadline' => '',
];

/* ---------- Origem ---------- */

$origem = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
$hostOrigem = $origem ? strtolower((string) parse_url($origem, PHP_URL_HOST)) : '';
if ($hostOrigem === '' || !in_array($hostOrigem, $cfg['allowed_hosts'], true)) {
    responder(403, ['ok' => false, 'erro' => 'Origem não permitida.']);
}

/* ---------- Corpo ---------- */

$raw = file_get_contents('php://input', false, null, 0, 32768);
$in = json_decode((string) $raw, true);
if (!is_array($in)) {
    responder(400, ['ok' => false, 'erro' => 'Dados inválidos.']);
}

// Armadilha: robôs preenchem o campo escondido. Responde "ok" sem enviar nada.
if (!empty($in['hp'])) {
    responder(200, ['ok' => true]);
}

$D = json_decode((string) file_get_contents(__DIR__ . '/dados.json'), true);
if (!is_array($D)) {
    responder(500, ['ok' => false, 'erro' => 'Metodologia indisponível.']);
}

function texto($v, int $max): string
{
    $v = is_string($v) ? $v : '';
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    $v = trim($v);
    return mb_substr($v, 0, $max);
}
function linha($v, int $max): string
{
    return str_replace(["\r", "\n"], ' ', texto($v, $max));
}

$c = is_array($in['contact'] ?? null) ? $in['contact'] : [];
$cl = is_array($in['closing'] ?? null) ? $in['closing'] : [];

$PREOC = ['A névoa no caixa', 'A falta de compromisso da equipe', 'A minha exaustão física e mental', 'Outro'];
$PREF = ['WhatsApp', 'E-mail', 'Ligação'];

$dado = [
    'nome' => linha($c['name'] ?? '', 120),
    'empresa' => linha($c['company'] ?? '', 160),
    'whatsapp' => preg_replace('/\D/', '', (string) ($c['whatsapp'] ?? '')),
    'email' => linha($c['email'] ?? '', 160),
    'preocupacao' => linha($cl['principal_preocupacao'] ?? '', 60),
    'comentario' => texto($cl['comentario_adicional'] ?? '', 2000),
    'preferencia' => linha($cl['preferencia_contato'] ?? '', 20),
];
$erros = [];
$dado['nome'] = preg_replace('/\s+/u', ' ', $dado['nome']);
$dado['empresa'] = preg_replace('/\s+/u', ' ', $dado['empresa']);

// Mesmos critérios do formulário (app.js: validarNome, validarEmpresa, validarWhatsapp, validarEmail).
$L = 'A-Za-zÀ-ÖØ-öø-ÿ';
$partes = array_values(array_filter(explode(' ', $dado['nome']), fn($p) => preg_match("/[$L]/u", $p)));
if (!preg_match("/^[$L' .\-]+$/u", $dado['nome']) || count($partes) < 2 || mb_strlen(preg_replace("/[^$L]/u", '', $partes[0])) < 2
    || preg_match('/(.)\1{3,}/iu', str_replace(' ', '', $dado['nome']))) $erros[] = 'nome';
$LIXO = ['teste', 'test', 'testes', 'asdf', 'qwerty', 'abc', 'xxx', 'xxxx', 'empresa', 'minha empresa', 'nenhuma', 'nenhum', 'na', 'n/a', 'nao tem', 'não tem', 'sem empresa', '-', '.'];
$alnum = preg_replace("/[^0-9$L]/u", '', $dado['empresa']);
if (mb_strlen($alnum) < 2 || !preg_match("/[$L]/u", $dado['empresa']) || in_array(mb_strtolower($dado['empresa']), $LIXO, true)
    || preg_match('/(.)\1{3,}/iu', str_replace(' ', '', $dado['empresa']))) $erros[] = 'empresa';
if (!in_array($dado['preocupacao'], $PREOC, true)) $erros[] = 'principal_preocupacao';
if (!in_array($dado['preferencia'], $PREF, true)) $erros[] = 'preferencia_contato';
$w = $dado['whatsapp'];
if (strlen($w) >= 12 && strpos($w, '55') === 0) $w = substr($w, 2);
if (strlen($w) === 11 && $w[0] === '0') $w = substr($w, 1);
$DDDS = [11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99];
$num = substr($w, 2);
if (!in_array(strlen($w), [10, 11], true) || !in_array((int) substr($w, 0, 2), $DDDS, true) || preg_match('/^(\d)\1+$/', $num)
    || (strlen($w) === 11 && $num[0] !== '9') || (strlen($w) === 10 && strpos('6789', $num[0]) !== false)) $erros[] = 'whatsapp';
$dado['whatsapp'] = $w;
$dado['email'] = mb_strtolower($dado['email']);
if (!filter_var($dado['email'], FILTER_VALIDATE_EMAIL)) {
    $erros[] = 'email';
} elseif (function_exists('checkdnsrr')) {
    // O domínio precisa existir e aceitar e-mail.
    $dom = substr(strrchr($dado['email'], '@'), 1);
    if (!checkdnsrr($dom, 'MX') && !checkdnsrr($dom, 'A')) $erros[] = 'email';
}
if (($cl['consentimento'] ?? false) !== true) $erros[] = 'consentimento';

$notasIn = is_array($in['notas'] ?? null) ? $in['notas'] : [];
$notas = [];
foreach ($D['indicadores'] as $ind) {
    $v = $notasIn[$ind['codigo']] ?? null;
    if (!is_int($v) && !(is_float($v) && floor($v) == $v)) { $erros[] = 'nota ' . $ind['codigo']; continue; }
    $v = (int) $v;
    if ($v < 0 || $v > 10) { $erros[] = 'nota ' . $ind['codigo']; continue; }
    $notas[$ind['codigo']] = $v;
}
if ($erros) {
    responder(422, ['ok' => false, 'erro' => 'Revise os dados enviados.', 'campos' => array_values(array_unique($erros))]);
}

// Filtro de spam no texto livre: links, marcação e textos-padrão de robôs.
$com = $dado['comentario'];
$links = preg_match_all('~(https?://|www\.|\b[a-z0-9-]+\.(com|net|org|ru|xyz|top|info|biz|io|cn)\b)~iu', $com);
if ($links > 1 || preg_match('~<\s*a\s|\[url|\[link|href\s*=~iu', $com)
    || preg_match('~\b(viagra|cialis|casino|crypto|bitcoin|forex|loan|seo services|backlinks?)\b~iu', $com)
    || preg_match('~https?://|www\.~iu', $dado['nome'] . ' ' . $dado['empresa'])) {
    error_log('[genesis] bloqueado por filtro de spam');
    responder(422, ['ok' => false, 'erro' => 'O texto parece spam. Retire os links e tente de novo.', 'campos' => ['comentario_adicional']]);
}

// Verificação antirrobô da Cloudflare (Turnstile), quando configurada.
if (!empty($cfg['turnstile_secret'])) {
    $token = is_string($in['turnstile'] ?? null) ? $in['turnstile'] : '';
    if ($token === '' || strlen($token) > 2048) responder(403, ['ok' => false, 'erro' => 'Confirme que você não é um robô.']);
    $corpo = http_build_query(['secret' => $cfg['turnstile_secret'], 'response' => $token, 'remoteip' => $_SERVER['REMOTE_ADDR'] ?? '']);
    $resp = false;
    if (function_exists('curl_init')) {
        $ch = curl_init('https://challenges.cloudflare.com/turnstile/v0/siteverify');
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $corpo, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8]);
        $resp = curl_exec($ch);
        curl_close($ch);
    } else {
        $resp = @file_get_contents('https://challenges.cloudflare.com/turnstile/v0/siteverify', false, stream_context_create(['http' => ['method' => 'POST', 'header' => "Content-Type: application/x-www-form-urlencoded\r\n", 'content' => $corpo, 'timeout' => 8]]));
    }
    $ver = json_decode((string) $resp, true);
    if (empty($ver['success'])) {
        error_log('[genesis] Turnstile recusou: ' . json_encode($ver['error-codes'] ?? $resp));
        responder(403, ['ok' => false, 'erro' => 'Não foi possível confirmar que você não é um robô. Recarregue a página e tente de novo.']);
    }
}

// Tempo mínimo entre começar e enviar (o navegador também confere).
$inicio = isset($in['meta']['started_at']) ? strtotime((string) $in['meta']['started_at']) : false;
if ($inicio && (time() - $inicio) < (int) $cfg['min_seconds']) {
    responder(429, ['ok' => false, 'erro' => 'Envio rápido demais. Aguarde alguns segundos e tente de novo.']);
}

/* ---------- Limite de envios (IP guardado só como hash) ---------- */

$dataDir = __DIR__ . '/.data';
if (!is_dir($dataDir)) @mkdir($dataDir, 0750, true);
$logFile = $dataDir . '/envios.json';
$fh = @fopen($logFile, 'c+');
$agora = time();
$ipHash = hash('sha256', ($cfg['salt'] ?? 'genesis') . '|' . ($_SERVER['REMOTE_ADDR'] ?? ''));
$emailHash = hash('sha256', ($cfg['salt'] ?? 'genesis') . '|e|' . $dado['email']);
$registros = [];
if ($fh) {
    flock($fh, LOCK_EX);
    $registros = json_decode((string) stream_get_contents($fh), true) ?: [];
    $registros = array_values(array_filter($registros, fn($r) => is_array($r) && ($agora - (int) ($r['t'] ?? 0)) < 86400));
    $doIp = count(array_filter($registros, fn($r) => ($r['ip'] ?? '') === $ipHash));
    $doEmail = count(array_filter($registros, fn($r) => ($r['em'] ?? '') === $emailHash));
    if ($doIp >= (int) $cfg['max_per_ip_24h'] || $doEmail >= (int) $cfg['max_per_email_24h'] || count($registros) >= (int) $cfg['max_global_24h']) {
        flock($fh, LOCK_UN); fclose($fh);
        responder(429, ['ok' => false, 'erro' => 'Limite de envios atingido. Fale com o Conselho pelo WhatsApp.']);
    }
}

/* ---------- Cálculo (mesma lógica do termometro.js / planilha V5_1) ---------- */

function faixa(float $v, array $limites): int
{
    $v = (float) sprintf('%.15g', $v);
    foreach ($limites as $i => $l) if ($v >= $l) return $i;
    return count($limites);
}
$CORES = ['vermelho', 'amarelo', 'branco', 'verde'];
function nivel(float $v): array
{
    global $D, $CORES;
    $k = faixa($v, $D['limites']);
    return ['k' => $k, 'cor' => $CORES[$k], 'temperatura' => $D['temperaturas'][$k], 'status' => $D['status'][$k]];
}
function separar(string $f): array
{
    return preg_match('/^([^:\n]+):\s*\n?(.*)$/su', $f, $m) ? ['titulo' => trim($m[1]), 'texto' => trim($m[2])] : ['titulo' => '', 'texto' => $f];
}
$porCodigo = [];
foreach ($D['indicadores'] as $ind) {
    $n = $notas[$ind['codigo']];
    $porCodigo[$ind['codigo']] = $ind + ['nota' => $n, 'gravidade' => $n * $ind['peso']];
}
function ponderada(array $codigos): float
{
    global $porCodigo;
    $g = 0.0; $p = 0.0;
    foreach ($codigos as $c) { $g += $porCodigo[$c]['gravidade']; $p += $porCodigo[$c]['peso']; }
    return $p > 0 ? $g / $p : 0.0;
}
$pilares = [];
foreach ($D['pilares'] as $pl) {
    $v = ponderada($pl['codigos']);
    $nv = nivel($v);
    $simples = array_sum(array_map(fn($c) => $porCodigo[$c]['nota'], $pl['codigos'])) / count($pl['codigos']);
    $pilares[] = ['nome' => preg_replace('/^\d+\.\s*/', '', $pl['nome']), 'especialistas' => $pl['especialistas'], 'v' => $v, 'simples' => $simples, 'nivel' => $nv, 'presc' => separar($pl['prescricoes'][$nv['k']])];
}
$todos = array_keys($porCodigo);
$igvoV = ponderada($todos); // D10 = G25
$igvoN = nivel($igvoV);
$igvoSimples = array_sum($notas) / count($notas); // C10 = E25
$igvoPresc = separar($D['igvo']['prescricoes'][$igvoN['k']]);
$matriz = [];
foreach ($D['matriz'] as $m) {
    $v = ponderada($m['codigos'] ?? $D['pilares'][$m['pilar']]['codigos']);
    $matriz[] = ['dimensao' => $m['dimensao'], 'v' => $v, 'nivel' => nivel($v), 'mod' => separar($m['modalidades'][faixa($v, $D['limitesMatriz'])]), 'conselheiros' => $m['conselheiros']];
}
usort($matriz, fn($a, $b) => $b['v'] <=> $a['v']);

/* ---------- E-mails ---------- */

function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function n(float $v, int $c): string { return number_format(round((float) sprintf('%.15g', $v), $c), $c, ',', '.'); }
$HEX = ['verde' => '#2f8f5b', 'branco' => '#8c94a3', 'amarelo' => '#c99a06', 'vermelho' => '#c0392b'];
$TXT = ['verde' => '#2f8f5b', 'branco' => '#5f6776', 'amarelo' => '#a67f05', 'vermelho' => '#c0392b'];
$dt = new DateTime('now', new DateTimeZone('America/Sao_Paulo'));
$quando = $dt->format('d/m/Y H:i') . ' (horário de Brasília)';
$tempCurta = fn(array $nv) => explode(' (', $nv['temperatura'])[0];

require __DIR__ . '/lib/emails.php';

/* ---------- Envio ---------- */

require __DIR__ . '/lib/PHPMailer/Exception.php';
require __DIR__ . '/lib/PHPMailer/PHPMailer.php';
require __DIR__ . '/lib/PHPMailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;

function novoEmail(array $cfg): PHPMailer
{
    $m = new PHPMailer(true);
    $m->isSMTP();
    $m->Host = $cfg['smtp_host'];
    $m->Port = (int) $cfg['smtp_port'];
    $m->SMTPAuth = true;
    $m->Username = $cfg['smtp_user'];
    $m->Password = $cfg['smtp_pass'];
    $sec = $cfg['smtp_secure'] ?? (((int) $cfg['smtp_port'] === 465) ? 'ssl' : 'tls');
    $m->SMTPSecure = $sec === 'ssl' ? PHPMailer::ENCRYPTION_SMTPS : ($sec === 'tls' ? PHPMailer::ENCRYPTION_STARTTLS : '');
    $m->SMTPAutoTLS = $sec !== '';
    $m->Timeout = 15;
    $m->CharSet = 'UTF-8';
    $m->setFrom($cfg['from_email'], $cfg['from_name']);
    $m->isHTML(true);
    return $m;
}

try {
    $m = novoEmail($cfg);
    $m->addAddress($cfg['team_to']);
    $m->addReplyTo($dado['email'], $dado['nome']);
    $m->Subject = 'Diagnóstico inicial — ' . $dado['empresa'] . ' · ' . $tempCurta($igvoN) . ' ' . explode(' (', $igvoN['status'])[0];
    $m->Body = $e;
    $m->AltBody = $eTxt;
    $m->send();
} catch (\Throwable $ex) {
    if ($fh) { flock($fh, LOCK_UN); fclose($fh); }
    $msg = $ex->getMessage() . (isset($m) && $m instanceof PHPMailer && $m->ErrorInfo ? ' | ' . $m->ErrorInfo : '');
    error_log('[genesis] falha no envio para a equipe: ' . $msg);
    // Código curto para diagnóstico, sem expor senha nem detalhes do servidor.
    $codigo = stripos($msg, 'authenticate') !== false ? 'smtp_autenticacao'
        : (stripos($msg, 'connect') !== false ? 'smtp_conexao'
        : (stripos($msg, 'recipient') !== false || stripos($msg, 'sender') !== false ? 'smtp_endereco' : 'smtp_outro'));
    responder(502, ['ok' => false, 'erro' => 'Não foi possível enviar agora. Tente de novo ou fale pelo WhatsApp.', 'codigo' => $codigo]);
}

if ($fh) {
    $registros[] = ['t' => $agora, 'ip' => $ipHash, 'em' => $emailHash];
    ftruncate($fh, 0); rewind($fh);
    fwrite($fh, json_encode($registros));
    flock($fh, LOCK_UN); fclose($fh);
}

// Cópia ao visitante: cortesia. Se falhar, o diagnóstico já chegou à equipe.
try {
    $m = novoEmail($cfg);
    $m->addAddress($dado['email'], $dado['nome']);
    $m->addReplyTo($cfg['team_to'], $cfg['from_name']);
    $m->Subject = 'Seu diagnóstico inicial — Projeto Gênesis';
    $m->Body = $v;
    $m->AltBody = $vTxt;
    $m->send();
} catch (\Throwable $ex) {
    error_log('[genesis] falha na cópia ao visitante: ' . $ex->getMessage());
}

responder(200, ['ok' => true]);
