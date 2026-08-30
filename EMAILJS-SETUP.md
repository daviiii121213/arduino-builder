# Ativar envio automático de e-mail no formulário de contato

O site é estático (HTML/CSS/JS puro, sem servidor). Para o formulário
enviar e-mails automaticamente — sem abrir o app de e-mail do
visitante — ele usa o [EmailJS](https://www.emailjs.com), que tem um
plano gratuito (200 envios/mês) e não exige backend próprio.

## Passo a passo (uns 5 minutos)

1. Crie uma conta em https://www.emailjs.com (pode usar login do Google).
2. Em **Email Services**, clique em "Add New Service" e conecte a conta
   `davi.devgenius@gmail.com` (ou outra que você queira receber as
   mensagens). Anote o **Service ID** gerado (ex: `service_abc1234`).
3. Em **Email Templates**, crie um template novo com variáveis assim:
   - Assunto: `{{subject}}`
   - Corpo:
     ```
     Nova mensagem pelo site DevGenius

     Nome: {{from_name}}
     E-mail: {{from_email}}
     Telefone: {{phone}}

     Mensagem:
     {{message}}
     ```
   - Em "To Email" do template, coloque `davi.devgenius@gmail.com`.
   - Anote o **Template ID** (ex: `template_xyz789`).
4. Em **Account > General**, copie sua **Public Key**.
5. Abra `index.html` e edite o bloco `EMAILJS_CONFIG` (perto do topo,
   dentro de `<head>`):

   ```html
   <script>
     window.EMAILJS_CONFIG = {
       enabled: true,                  // ative aqui
       publicKey: 'sua_public_key',
       serviceId: 'service_abc1234',
       templateId: 'template_xyz789'
     };
   </script>
   ```

6. Salve, suba o arquivo e teste enviando o formulário. As mensagens
   vão cair direto na caixa de entrada configurada, sem o visitante
   precisar abrir nenhum aplicativo.

Enquanto `enabled` estiver como `false`, o formulário continua
funcionando normalmente pelo modo alternativo: ele abre o aplicativo
de e-mail do visitante com a mensagem pronta para
`davi.devgenius@gmail.com`.

## E para "receber" e-mails no domínio da empresa?

Isso é separado do formulário do site — é sobre ter uma caixa de
e-mail profissional tipo `contato@devgenius.site` em vez de usar um
Gmail pessoal. As opções mais comuns:

- **Google Workspace** (pago, a partir de ~R$ 30/mês por usuário):
  Gmail com o seu domínio, o mais robusto.
- **Zoho Mail** (tem plano gratuito para poucos usuários): boa opção
  para começar sem custo.
- **Encaminhamento de e-mail do próprio registrador de domínio**
  (ex: Registro.br, GoDaddy): geralmente grátis, só redireciona
  `contato@seudominio.com` para o seu Gmail — não tem caixa própria,
  mas resolve para receber.

Depois de criar o e-mail profissional, é só trocar
`davi.devgenius@gmail.com` pelo novo endereço no `EMAILJS_CONFIG`,
no template do EmailJS e nos links `mailto:`/rodapé do site.
