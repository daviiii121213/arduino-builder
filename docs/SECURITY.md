# Segurança e privacidade

- **Senhas**: Argon2id com salt aleatório (crate `argon2`); nunca em texto puro nem em logs. Mínimo 8 caracteres com letras e números.
- **Tentativas de login**: após 5 erros o perfil espera 30 s, dobrando a cada nova falha.
- **Bloqueio**: manual (Ctrl+L) ou automático por inatividade; Diário pode exigir senha.
- **Autorização** em todas as operações no núcleo (não só na interface): sessão, dono do registro, papel e permissões da família, restrição por integrante.
- **SQL**: colunas de lista branca, valores parametrizados; ordenação e filtros validados.
- **Arquivos**: anexos copiados para a pasta do app; executáveis (.exe, .bat, .ps1…) bloqueados; acesso exige acesso ao registro; restauração rejeita caminhos com `..`.
- **FAMILY ID** não dá acesso: entrada só com código de convite temporário (72 h) ou aprovação.
- **Auditoria**: logins, cadastros, permissões, convites, compartilhamentos, backups e restaurações em `audit_logs`.
- **Backup completo** só pelo administrador da instalação (contém todos os perfis); cada perfil pode exportar só os próprios dados.

## Limitações (sem simulação)
- O arquivo `plu.db` **não é criptografado em repouso**. Quem tem acesso à conta do Windows pode lê-lo com ferramentas externas. Proteja a conta do Windows (BitLocker recomendado).
- Backups podem ser criptografados (AES-256-GCM, chave derivada da senha com Argon2id). Backups automáticos são salvos sem senha.
- Senha esquecida não tem recuperação (não há serviço online). Outro perfil não consegue redefinir.
