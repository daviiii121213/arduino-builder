# Instalação (Windows 10/11)

1. Execute `PERSONAL LIFE ULTRA_1.0.0_x64-setup.exe` (instalador NSIS, por usuário — não exige administrador).
2. O instalador inclui o WebView2 em modo offline; não é necessário instalar Node.js, Python nem ter internet.
3. Abra pelo menu Iniciar. O primeiro perfil criado vira administrador da instalação.

Também é gerado o executável `PersonalLifeUltra.exe` (requer WebView2, presente no Windows 11 e no Windows 10 atualizado).

## Atualizar
Instale a nova versão por cima. Os dados ficam em `%APPDATA%\com.personallifeultra.app\` e não são apagados. Faça um backup antes.

## Desinstalar
Configurações do Windows › Aplicativos › PERSONAL LIFE ULTRA › Desinstalar. Por padrão os dados permanecem; marque a opção de apagar dados do app apenas se quiser removê-los.

## Compilar a partir do código
Requisitos: Node 22, Rust estável, (Windows) Build Tools do Visual Studio.
```
npm ci
npx tauri build
```
Saída: `src-tauri/target/release/PersonalLifeUltra.exe` e `src-tauri/target/release/bundle/nsis/*.exe`. O workflow `.github/workflows/windows-build.yml` faz isso automaticamente em `windows-latest` e publica os artefatos.

## Desenvolvimento no navegador
```
npm run dev:core   # núcleo real em 127.0.0.1:1430
npm run dev        # interface em 127.0.0.1:1420
```
