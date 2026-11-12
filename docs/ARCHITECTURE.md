# Arquitetura — PERSONAL LIFE ULTRA

| Camada | Onde | Responsabilidade |
|---|---|---|
| Apresentação | `src/` (React + TypeScript) | Páginas, navegação, formulários, painéis, temas |
| Aplicação | `crates/plu-core/src/*.rs` | Regras de negócio, validações, automações, relatórios, backup |
| Domínio | `entities.rs`, `perms.rs`, `core.rs` | Entidades, permissões, contexto de usuário/família |
| Infraestrutura | `db.rs`, `migrations/`, `attachments.rs`, `backup.rs`, `pdf.rs` | SQLite, arquivos, exportação |
| Desktop | `src-tauri/` | Janela, IPC, bandeja, notificações do Windows, instância única |

## Fluxo de uma operação
Interface → `call(cmd, args)` (`src/api/client.ts`) → IPC Tauri (`api`) → `Core::call` → validação + autorização → SQLite (transação) → JSON de resposta.
Um único ponto de entrada (`Core::call`) garante que toda operação passa pela checagem de sessão e permissões.

## Decisões
- **Núcleo sem interface**: todo o comportamento fica em `plu-core`, testável com `cargo test` sem janela.
- **Motor genérico de entidades**: cada módulo é um `EntityDef` (colunas permitidas, tipos, ambiente, área de permissão). Nomes de colunas vêm só do registro estático; valores sempre por parâmetros SQL.
- **Tabelas**: entidades centrais têm tabelas próprias (`tasks`, `events`, `transactions`…); módulos de cauda longa usam `personal_records`/`family_records` com coluna `module` e JSON `data`.
- **Servidor de desenvolvimento** (`plu-devserver`, feature `devserver`): só para testes no navegador; não entra no instalador.
- **Rotina periódica** (60 s): lembretes, automações, bloqueio por inatividade, backup automático.
- **Sem internet**: nenhuma API, fonte, CDN ou imagem remota. Ícones (lucide) e ilustrações SVG são empacotados.
