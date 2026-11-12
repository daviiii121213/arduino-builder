# Backup e restauração

## Formato `.pluback`
ZIP com `manifest.json` (formato, versão do formato, versão do app, versão do esquema, data, lista de arquivos com SHA-256), `plu.db` (cópia consistente via `VACUUM INTO`) e `attachments/` (anexos e fotos de perfil, preservando caminhos e identificadores).
Com senha: arquivo começa com `PLUENC1` + salt (16 B) + nonce (12 B) + ZIP cifrado com AES-256-GCM (chave Argon2id).

## Criar
Configurações › Backup e dados › **Criar backup** (escolha o local; senha opcional). O arquivo é gravado como `.partial` e renomeado só no fim, depois é relido e verificado (hashes). Somente o administrador da instalação (primeiro perfil) faz backup completo.

## Backup automático
Ative em Backup e dados: intervalo (dias), pasta e quantos manter. Roda com o aplicativo aberto (ou na bandeja).

## Verificar
**Verificar arquivo** confere manifesto, versões e SHA-256 de cada arquivo, sem alterar nada.

## Restaurar
1. Configurações › Backup e dados › **Restaurar**, selecione o `.pluback` (e a senha, se houver).
2. Confirme com a senha do seu perfil.
3. O app cria automaticamente `backups/antes-da-restauracao-*.pluback` com o estado atual, valida o backup (incluindo `PRAGMA integrity_check`), troca os arquivos e reabre o banco (aplicando migrações se o backup for de versão anterior). Backups de versão mais nova são recusados.
4. A sessão é encerrada: entre novamente.

## Exportar meus dados
Disponível a todo perfil: ZIP com `dados.json` (registros pessoais) e os anexos próprios.

## Onde ficam os dados
`%APPDATA%\com.personallifeultra.app\` — `plu.db`, `attachments\`, `backups\`, `exports\`, `logs\app.log`.
