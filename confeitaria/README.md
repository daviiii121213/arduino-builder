# Doce Encanto — Sistema para Confeitaria

Sistema web completo (Painel do Cliente + Painel do Vendedor) para uma confeitaria brasileira,
com catálogo real, carrinho, checkout, pedidos sincronizados, estoque, agenda e financeiro.
Toda a interface está em português do Brasil e os valores em Real (R$).

## Como executar

```bash
npm install
npm run dev      # ambiente de desenvolvimento em http://localhost:5173
```

Build de produção:

```bash
npm run build
npm run preview  # serve o build em http://localhost:4173
```

## Acessos

| Área | Como entrar |
| --- | --- |
| Painel do Cliente | Botão **Entrar na loja** na tela inicial |
| Painel do Vendedor | Botão discreto **Vendedor** (rodapé da tela inicial) + código **123** |

O acesso do vendedor é anônimo: não pede nome, e-mail, senha nem cadastro.
O cliente é identificado apenas por nome + WhatsApp (sem senha).

## Funcionalidades

**Cliente:** início com destaques e categorias, cardápio com busca/filtros/ordenação,
detalhe do produto com quantidade, tamanhos, recheios, coberturas, adicionais e observações,
carrinho persistente, checkout em duas etapas com revisão completa, acompanhamento dos pedidos
com linha do tempo (Pedido recebido → Confirmado → Em produção → Pronto → Entregue) e área da conta
com dados, endereços e histórico.

**Vendedor:** dashboard com faturamento do dia/mês, pedidos por status, próximas entregas,
produtos mais vendidos, alertas de estoque e gráficos; gestão de pedidos (lista e quadro, busca,
filtros, detalhes, mudança de status e cancelamento); CRUD completo de produtos com grupos de
personalização e imagem (ilustração da casa, URL ou upload); estoque de ingredientes com entradas,
saídas, mínimo e histórico; clientes com ficha e observações; agenda mensal de entregas e retiradas;
financeiro com faturamento, despesas, lucro, formas de pagamento e filtros por período;
configurações da confeitaria (dados, taxas, pagamentos e cores do sistema).

Os dois painéis compartilham o mesmo estado: um pedido criado pelo cliente aparece no painel do
vendedor, e qualquer mudança de status ou de produto reflete imediatamente na loja.

## Arquitetura

```
src/
  components/    componentes de interface reutilizáveis (modal, toast, cards, ilustrações)
  data/          catálogo inicial, categorias e dados de demonstração
  lib/           persistência (driver de armazenamento), formatação pt-BR, status e rotas
  pages/         telas do cliente (pages/customer) e do vendedor (pages/seller)
  store/         estado global da aplicação e do carrinho
  styles/        design system (tokens, base, componentes, loja e painel)
```

### Persistência

Toda a aplicação conversa apenas com a interface `StorageDriver` (`src/lib/db.ts`), que é
assíncrona de propósito. Hoje ela é implementada por `LocalStorageDriver` (dados salvos no
navegador, com sincronização entre abas e versionamento/migração). Para migrar para um backend
real basta criar um `HttpStorageDriver` com os mesmos métodos (`load`, `save`, `clear`,
`subscribe`) — nenhuma tela precisa ser alterada.

Dados persistidos: produtos, pedidos, clientes, estoque, movimentações, despesas, configurações,
sessão do cliente e carrinho.

## Imagens dos produtos

As ilustrações do catálogo são vetoriais (SVG) e foram desenhadas especificamente para este
projeto (`src/components/ProductArt.tsx`): ficam nítidas em qualquer tela, não dependem de rede e
não têm restrição de licença. No painel, o vendedor pode substituir a ilustração de qualquer
produto por uma foto própria (upload ou URL).

## Stack

React 19 + TypeScript + Vite, CSS próprio (design system em `src/styles`) e Recharts para gráficos.
