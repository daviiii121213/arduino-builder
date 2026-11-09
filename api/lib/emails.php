<?php
/**
 * Projeto Gênesis — modelos dos e-mails (equipe e visitante).
 * Incluído por enviar.php; usa as variáveis já calculadas lá ($dado, $pilares, $matriz, $porCodigo, $igvo*, $cfg, $D).
 * Layout em tabelas e estilos inline, 600 px, para funcionar no Gmail, Outlook, Apple Mail e celular.
 */

if (!defined('GENESIS_EMAILS')) define('GENESIS_EMAILS', 1);

$SITE = rtrim($cfg['site_url'] ?? 'https://www.genesisintegrativa.com.br', '/');
$WA = preg_replace('/\D/', '', (string) ($cfg['whatsapp'] ?? '5534998593233'));
$WA_FMT = $cfg['whatsapp_exibicao'] ?? '(34) 99859-3233';
$IG = $cfg['instagram'] ?? 'https://www.instagram.com/genesisintegrativa.com.br/';

$NAVY = '#0A0F1A'; $NAVY2 = '#121A2B'; $GOLD = '#C9A24A'; $GOLD_D = '#8A6A22'; $INK = '#1B2233'; $MUTED = '#5B6475'; $LINE = '#E6E8EE'; $BG = '#EEF0F4';
$FONT = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;";
$SERIF = "font-family:Georgia,'Times New Roman',serif;";
$SOFT = ['verde' => '#E8F4EE', 'branco' => '#F1F2F5', 'amarelo' => '#FBF3DC', 'vermelho' => '#FBE9E7'];

function moldura(string $preheader, string $corpo, string $rodapeExtra = ''): string
{
    global $SITE, $WA, $WA_FMT, $IG, $NAVY, $NAVY2, $GOLD, $INK, $BG, $FONT, $cfg;
    $email = h($cfg['from_email']);
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>Projeto Gênesis</title>'
        . '<style>@media only screen and (max-width:620px){.gx-pad{padding-left:22px!important;padding-right:22px!important}.gx-h1{font-size:22px!important}}</style></head>'
        . '<body style="margin:0;padding:0;background:' . $BG . ';">'
        . '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">' . h($preheader) . '&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' . $BG . ';"><tr><td align="center" style="padding:28px 12px">'
        . '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:separate;">'
        // Cabeçalho com imagem
        . '<tr><td style="background:' . $NAVY . ';border-radius:14px 14px 0 0;overflow:hidden;line-height:0;font-size:0">'
        . '<a href="' . $SITE . '/" target="_blank" style="text-decoration:none"><img src="' . $SITE . '/assets/img/email-cabecalho.jpg" width="600" height="300" alt="Projeto Gênesis" '
        . 'style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:14px 14px 0 0;background:' . $NAVY . ';color:' . $GOLD . ';' . $FONT . 'font-size:28px;line-height:300px;text-align:center;letter-spacing:6px"></a></td></tr>'
        . '<tr><td style="background:' . $GOLD . ';height:3px;line-height:3px;font-size:0">&nbsp;</td></tr>'
        // Corpo
        . '<tr><td class="gx-pad" style="background:#ffffff;padding:36px 40px 32px;' . $FONT . 'color:' . $INK . ';font-size:15px;line-height:1.6">' . $corpo . '</td></tr>'
        // Rodapé
        . '<tr><td class="gx-pad" style="background:' . $NAVY . ';border-radius:0 0 14px 14px;padding:28px 40px 30px;' . $FONT . 'color:#B8BCC4;font-size:12px;line-height:1.7">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
        . '<td style="' . $FONT . 'font-size:11px;letter-spacing:3px;color:' . $GOLD . ';font-weight:bold;padding-bottom:4px">PROJETO</td></tr>'
        . '<tr><td style="' . $FONT . 'font-size:20px;letter-spacing:5px;color:#ffffff;font-weight:bold;padding-bottom:14px">GENESIS</td></tr>'
        . '<tr><td style="' . $FONT . 'font-size:13px;color:#D9DCE2;padding-bottom:16px;font-style:italic">“Empresas fortes são construídas quando estratégia, gestão financeira e pessoas evoluem juntas.”</td></tr>'
        . '<tr><td style="border-top:1px solid #222B3D;padding-top:16px;' . $FONT . 'font-size:12px;color:#B8BCC4">'
        . '<a href="https://wa.me/' . $WA . '" style="color:#ffffff;text-decoration:none">WhatsApp ' . h($WA_FMT) . '</a>'
        . ' &nbsp;·&nbsp; <a href="mailto:' . $email . '" style="color:#ffffff;text-decoration:none">' . $email . '</a>'
        . ' &nbsp;·&nbsp; <a href="' . h($IG) . '" style="color:#ffffff;text-decoration:none">Instagram</a>'
        . ' &nbsp;·&nbsp; <a href="' . $SITE . '/" style="color:' . $GOLD . ';text-decoration:none">genesisintegrativa.com.br</a></td></tr>'
        . '<tr><td style="padding-top:14px;' . $FONT . 'font-size:11px;color:#8C93A1;line-height:1.6">'
        . 'O Projeto Gênesis oferece suporte em saúde integrativa e não presta serviços médicos.' . ($rodapeExtra ? '<br>' . $rodapeExtra : '')
        . '<br>© ' . date('Y') . ' Projeto Gênesis · <a href="' . $SITE . '/#politica" style="color:#8C93A1">Política de Privacidade</a></td></tr>'
        . '</table></td></tr>'
        . '</table></td></tr></table></body></html>';
}

function eyebrow(string $t): string
{
    global $GOLD_D, $FONT;
    return '<div style="' . $FONT . 'font-size:11px;letter-spacing:3px;color:' . $GOLD_D . ';font-weight:bold;text-transform:uppercase;margin:0 0 10px">' . h($t) . '</div>';
}

function titulo(string $t): string
{
    global $INK, $SERIF;
    return '<h1 class="gx-h1" style="margin:0 0 14px;' . $SERIF . 'font-size:26px;line-height:1.25;color:' . $INK . ';font-weight:normal">' . h($t) . '</h1>';
}

function secaoT(string $t): string
{
    global $GOLD_D, $LINE, $FONT;
    return '<div style="margin:30px 0 12px;padding-top:22px;border-top:1px solid ' . $LINE . ';' . $FONT . 'font-size:11px;letter-spacing:2.5px;color:' . $GOLD_D . ';font-weight:bold">' . h($t) . '</div>';
}

function pilula(string $t, string $cor): string
{
    global $HEX, $TXT, $SOFT, $FONT;
    return '<span style="display:inline-block;padding:5px 12px;border-radius:999px;background:' . $SOFT[$cor] . ';border:1px solid ' . $HEX[$cor] . ';color:' . $TXT[$cor] . ';' . $FONT . 'font-size:11px;font-weight:bold;letter-spacing:.5px">' . h($t) . '</span>';
}

// Faixa com as 4 temperaturas; a atual em destaque.
function faixaTemperaturas(string $corAtual): string
{
    global $HEX, $SOFT, $TXT, $FONT, $MUTED;
    $itens = [['verde', '36.2°C', 'Saudável'], ['branco', '37.2°C', 'Subfebril'], ['amarelo', '38.5°C', 'Febre ativa'], ['vermelho', '39.5°C+', 'Febre alta']];
    $h = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:4px 0;margin:18px 0 4px"><tr>';
    foreach ($itens as [$cor, $t, $nome]) {
        $on = $cor === $corAtual;
        $h .= '<td width="25%" align="center" style="padding:10px 4px;border-radius:8px;background:' . ($on ? $HEX[$cor] : $SOFT[$cor]) . ';' . $FONT . '">'
            . '<div style="font-size:13px;font-weight:bold;color:' . ($on ? '#ffffff' : $TXT[$cor]) . '">' . $t . '</div>'
            . '<div style="font-size:10px;letter-spacing:.5px;color:' . ($on ? '#ffffff' : $MUTED) . ';text-transform:uppercase">' . $nome . '</div></td>';
    }
    return $h . '</tr></table>';
}

function botao(string $href, string $rotulo): string
{
    global $GOLD, $NAVY, $FONT;
    return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 6px"><tr>'
        . '<td align="center" bgcolor="' . $GOLD . '" style="border-radius:8px;background:' . $GOLD . '">'
        . '<a href="' . h($href) . '" target="_blank" style="display:inline-block;padding:15px 28px;' . $FONT . 'font-size:15px;font-weight:bold;color:' . $NAVY . ';text-decoration:none;border-radius:8px">' . h($rotulo) . '</a></td></tr></table>';
}

$primeiro = explode(' ', $dado['nome'])[0];
$temp = $tempCurta($igvoN);
$tempNome = preg_match('/\(([^)]+)\)/', $igvoN['temperatura'], $mm) ? $mm[1] : '';
$prazo = $cfg['response_deadline'] ? ' em até ' . h($cfg['response_deadline']) : '';

/* ===================== VISITANTE ===================== */

$waMsg = "Olá! Fiz o diagnóstico inicial no site do Projeto Gênesis.\nEmpresa: {$dado['empresa']}\nTermômetro: {$igvoN['temperatura']}\nQuero conversar sobre o resultado.";
$corpoV = eyebrow('Termômetro Organizacional')
    . titulo('Olá, ' . $primeiro . '. Aqui está a temperatura da ' . $dado['empresa'] . '.')
    . '<p style="margin:0 0 22px;color:' . $MUTED . '">Obrigado por responder ao diagnóstico inicial do Projeto Gênesis. Este é o resultado calculado a partir das suas respostas.</p>'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:12px;background:' . $NAVY . ';border-collapse:separate"><tr><td style="padding:26px 28px;' . $FONT . '">'
    . '<div style="font-size:11px;letter-spacing:3px;color:' . $GOLD . ';font-weight:bold">TEMPERATURA DA SUA EMPRESA</div>'
    . '<div style="font-size:52px;line-height:1.1;font-weight:bold;color:#ffffff;margin:8px 0 2px">' . h($temp) . '</div>'
    . '<div style="font-size:15px;color:#D9DCE2;margin-bottom:14px">' . h($tempNome) . '</div>'
    . pilula($igvoN['status'], $igvoN['cor'])
    . '</td></tr></table>'
    . faixaTemperaturas($igvoN['cor'])
    . secaoT('PRÓXIMO PASSO')
    . '<p style="margin:0 0 6px">Um conselheiro do Projeto Gênesis vai entrar em contato' . $prazo . ' para agendar uma <strong>reunião aprofundada</strong> e explicar o que essa temperatura significa para a sua empresa.</p>'
    . botao('https://wa.me/' . $WA . '?text=' . rawurlencode($waMsg), 'Conversar sobre o resultado no WhatsApp')
    . '<p style="margin:18px 0 0;font-size:13px;color:' . $MUTED . '">Este é um diagnóstico inicial, para abrir a conversa. A análise completa do Conselho acontece no diagnóstico integrado, já dentro do ciclo.</p>';
$v = moldura('A temperatura da sua empresa: ' . $temp . ' · ' . $tempNome, $corpoV,
    'Você recebeu este e-mail porque respondeu ao diagnóstico inicial em genesisintegrativa.com.br.');
$vTxt = "Olá, {$primeiro}. Obrigado por responder ao Termômetro Organizacional do Projeto Gênesis.\n\n"
    . "Temperatura da {$dado['empresa']}: {$igvoN['temperatura']} · {$igvoN['status']}\n\n"
    . "Um conselheiro vai entrar em contato" . ($cfg['response_deadline'] ? ' em até ' . $cfg['response_deadline'] : '') . " para agendar uma reunião aprofundada.\n"
    . "WhatsApp: https://wa.me/{$WA}\n\nProjeto Gênesis · {$cfg['from_email']} · {$SITE}\n"
    . "O Projeto Gênesis oferece suporte em saúde integrativa e não presta serviços médicos.";

/* ===================== EQUIPE ===================== */

$linhaDado = function (string $rot, string $valorHtml) use ($MUTED, $LINE, $FONT) {
    return '<tr><td width="34%" style="padding:9px 0;border-bottom:1px solid ' . $LINE . ';' . $FONT . 'font-size:12px;color:' . $MUTED . ';vertical-align:top">' . h($rot) . '</td>'
        . '<td style="padding:9px 0;border-bottom:1px solid ' . $LINE . ';' . $FONT . 'font-size:14px;vertical-align:top">' . $valorHtml . '</td></tr>';
};
$waCliente = (strlen($dado['whatsapp']) <= 11 ? '55' : '') . $dado['whatsapp'];

$corpoE = eyebrow('Novo diagnóstico inicial · ' . $quando)
    . titulo($dado['empresa'])
    . '<p style="margin:0 0 20px;color:' . $MUTED . '">' . h($dado['nome']) . ' · prefere contato por <strong style="color:' . $INK . '">' . h($dado['preferencia']) . '</strong></p>'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:12px;background:' . $NAVY . ';border-collapse:separate"><tr>'
    . '<td style="padding:24px 26px;' . $FONT . '">'
    . '<div style="font-size:11px;letter-spacing:3px;color:' . $GOLD . ';font-weight:bold">' . 'TEMPERATURA GERAL DA EMPRESA' . '</div>'
    . '<div style="font-size:44px;line-height:1.1;font-weight:bold;color:#ffffff;margin:8px 0 4px">' . n($igvoV, 2) . ' <span style="font-size:14px;font-weight:normal;color:#B8BCC4">de 10</span></div>'
    . '<div style="font-size:13px;color:#B8BCC4;margin-bottom:12px">Média ponderada global · média simples ' . n($igvoSimples, 1) . ' · ' . h($igvoN['temperatura']) . '</div>'
    . pilula($igvoN['status'], $igvoN['cor'])
    . '<div style="margin-top:16px;padding:12px 14px;border-radius:8px;background:' . $NAVY2 . ';font-size:13px;line-height:1.55;color:#E6E8EE"><strong style="color:' . $GOLD . '">' . h($igvoPresc['titulo']) . ':</strong> ' . h($igvoPresc['texto']) . '</div>'
    . '</td></tr></table>'
    . botao('https://wa.me/' . $waCliente, 'Responder no WhatsApp do cliente')
    . secaoT('CONTATO')
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
    . $linhaDado('WhatsApp', '<a href="https://wa.me/' . h($waCliente) . '" style="color:' . $INK . '">' . h($dado['whatsapp']) . '</a>')
    . $linhaDado('E-mail', '<a href="mailto:' . h($dado['email']) . '" style="color:' . $INK . '">' . h($dado['email']) . '</a>')
    . '</table>'
    . secaoT('CENÁRIO ATUAL · PERCEPÇÃO DO CLIENTE')
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
    . $linhaDado('O que mais tira o sono', '<strong>' . h($dado['preocupacao']) . '</strong>')
    . $linhaDado('Comentário', nl2br(h($dado['comentario'] !== '' ? $dado['comentario'] : 'Não informado.')))
    . '</table>'
    . secaoT('OS 4 PILARES');
foreach ($pilares as $p) {
    $cor = $p['nivel']['cor'];
    $corpoE .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;border-radius:10px;background:' . $SOFT[$cor] . ';border-left:4px solid ' . $HEX[$cor] . ';border-collapse:separate"><tr>'
        . '<td style="padding:14px 16px;' . $FONT . '"><div style="font-size:14px;font-weight:bold;color:' . $INK . '">' . h($p['nome']) . '</div>'
        . '<div style="font-size:12px;color:' . $MUTED . ';margin:2px 0 8px">' . h($p['especialistas']) . '</div>'
        . '<div style="font-size:13px;line-height:1.5"><strong>' . h($p['presc']['titulo']) . ':</strong> ' . h($p['presc']['texto']) . '</div></td>'
        . '<td width="92" align="right" style="padding:14px 16px 14px 0;vertical-align:top;' . $FONT . '"><div style="font-size:22px;font-weight:bold;color:' . $TXT[$cor] . '">' . n($p['v'], 2) . '</div>'
        . '<div style="font-size:11px;color:' . $MUTED . '">' . h(explode(' (', $p['nivel']['temperatura'])[0]) . '</div></td></tr></table>';
}
$corpoE .= secaoT('PLANO DE TRATAMENTO · DO MAIS GRAVE AO MENOS GRAVE');
foreach ($matriz as $m) {
    $cor = $m['nivel']['cor'];
    $corpoE .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;border:1px solid ' . $LINE . ';border-radius:10px;border-collapse:separate"><tr>'
        . '<td width="70" align="center" style="padding:14px 0;vertical-align:top;' . $FONT . '"><span style="display:inline-block;min-width:44px;padding:6px 6px;border-radius:6px;background:' . $SOFT[$cor] . ';color:' . $TXT[$cor] . ';font-weight:bold;font-size:13px">' . n($m['v'], 2) . '</span></td>'
        . '<td style="padding:14px 16px 14px 0;' . $FONT . '"><div style="font-size:14px;font-weight:bold">' . h($m['dimensao']) . '</div>'
        . '<div style="font-size:12px;color:' . $GOLD_D . ';font-weight:bold;margin:3px 0 6px">' . h($m['mod']['titulo']) . '</div>'
        . '<div style="font-size:13px;line-height:1.5">' . h($m['mod']['texto']) . '</div>'
        . '<div style="font-size:12px;color:' . $MUTED . ';margin-top:6px">' . h(implode(' · ', $m['conselheiros'])) . '</div></td></tr></table>';
}
$corpoE .= secaoT('AS 20 RESPOSTAS · NOTA × PESO = GRAVIDADE')
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px">';
foreach ($porCodigo as $i) {
    $cor = nivel((float) $i['nota'])['cor'];
    $corpoE .= '<tr><td style="padding:7px 0;border-bottom:1px solid ' . $LINE . ';' . $FONT . 'font-size:13px"><strong>' . h($i['codigo']) . '</strong> · ' . h($i['dimensao']) . '</td>'
        . '<td align="right" style="padding:7px 0;border-bottom:1px solid ' . $LINE . ';white-space:nowrap;' . $FONT . 'font-size:13px;color:' . $MUTED . '">'
        . '<strong style="color:' . $TXT[$cor] . '">' . $i['nota'] . '</strong> × ' . n((float) $i['peso'], 1) . ' = <strong style="color:' . $INK . '">' . n((float) $i['gravidade'], 2) . '</strong></td></tr>';
}
$corpoE .= '</table><p style="margin:18px 0 0;font-size:11px;color:' . $MUTED . ';word-break:break-word">Metodologia: ' . h(str_replace('_', ' ', preg_replace('/\.xlsx$/', '', $D['fonte']))) . '. Responder a este e-mail responde direto ao cliente.</p>';

$e = moldura('Novo diagnóstico: ' . $dado['empresa'] . ' · geral ' . n($igvoV, 2) . ' · ' . $temp, $corpoE, 'E-mail interno da equipe do Projeto Gênesis. Contém dados pessoais: não encaminhe fora do Conselho.');
$eTxt = "Novo diagnóstico inicial — {$dado['empresa']}\n{$dado['nome']} · {$quando}\n\n"
    . "Temperatura geral: " . n($igvoV, 2) . " (simples " . n($igvoSimples, 1) . ") — {$igvoN['temperatura']} · {$igvoN['status']}\n"
    . "{$igvoPresc['titulo']}: {$igvoPresc['texto']}\n\n"
    . "WhatsApp: {$dado['whatsapp']} · E-mail: {$dado['email']} · Prefere: {$dado['preferencia']}\n"
    . "O que mais tira o sono: {$dado['preocupacao']}\nComentário: " . ($dado['comentario'] !== '' ? $dado['comentario'] : 'Não informado.') . "\n\nPILARES\n";
foreach ($pilares as $p) $eTxt .= "• {$p['nome']}: " . n($p['v'], 2) . " — {$p['nivel']['status']} — {$p['presc']['titulo']}\n";
$eTxt .= "\nPLANO\n";
foreach ($matriz as $m) $eTxt .= "• {$m['dimensao']} (" . n($m['v'], 2) . "): {$m['mod']['titulo']}\n";
$eTxt .= "\nRESPOSTAS\n";
foreach ($porCodigo as $i) $eTxt .= "{$i['codigo']} · {$i['dimensao']}: {$i['nota']} × " . n((float) $i['peso'], 1) . " = " . n((float) $i['gravidade'], 2) . "\n";
