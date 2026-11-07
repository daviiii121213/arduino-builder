<?php
/*
 * Modelo de configuração do envio de e-mails do Projeto Gênesis.
 *
 * COMO USAR (no Gerenciador de Arquivos do cPanel):
 *   1. Copie este arquivo para FORA do public_html, na pasta da sua conta
 *      (ex.: /home/SEU_USUARIO/genesis-smtp.php), ao lado da pasta public_html.
 *   2. Preencha smtp_pass com a senha da caixa contato@ no Titan.
 *   3. Apague este arquivo de exemplo do servidor depois de copiar.
 *
 * Fora do public_html, este arquivo não pode ser aberto pelo navegador.
 */
return [
    'smtp_host'  => 'smtp.titan.email',
    'smtp_port'  => 465,                 // 465 = SSL. Alternativa: 587 com 'smtp_secure' => 'tls'
    'smtp_user'  => 'contato@genesisintegrativa.com.br',
    'smtp_pass'  => '',                  // <<< senha da caixa contato@ (Titan)
    'from_email' => 'contato@genesisintegrativa.com.br',
    'from_name'  => 'Projeto Gênesis',
    'team_to'    => 'contato@genesisintegrativa.com.br', // quem recebe o laudo completo
    'salt'       => 'troque-por-uma-frase-qualquer',      // usado para não guardar o IP em claro
    'response_deadline' => '',           // ex.: '2 dias úteis'
    'turnstile_secret'  => '',           // Cloudflare Turnstile > Secret Key. Vazio = desligado (preencha junto com turnstileSiteKey no config.js)
];
