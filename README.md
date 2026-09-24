# Órbita · radar de investimentos (Banco Inter)

Site estático (HTML + JS, sem build) para:

- **Radar**: Selic, CDI, IPCA e Focus ao vivo do Banco Central + resumo da sua carteira
- **Ranking Inter**: produtos do Inter ordenados pelo rendimento **líquido** para o seu objetivo (reserva, meta com data, longo prazo)
- **Carteira**: suas aplicações com valor estimado, IR regressivo e líquido hoje
- **Simulador**: até 4 produtos lado a lado com aportes mensais
- **Metas**: quanto falta e quanto aportar por mês (ex.: intercâmbio)
- **Dashboards**: painéis que você monta (arrastar, redimensionar, configurar widgets)

```
orbita/
├── index.html          ← página + estilos
├── app.js              ← toda a lógica
├── config.js           ← suas chaves do Supabase (única coisa que você edita)
└── supabase/schema.sql ← tabelas + segurança (rodar 1x no Supabase)
```

Funciona sem Supabase (**modo local**: dados só no navegador). Com Supabase, você tem login e os dados sincronizam entre celular e computador.

---

## 1. Supabase (banco de dados + login) · ~5 min

1. Crie uma conta em https://supabase.com e clique em **New project** (região: *South America (São Paulo)*).
2. No menu lateral, abra **SQL Editor** → **New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**. Deve aparecer "Success".
3. Vá em **Project Settings → API** e copie:
   - **Project URL**
   - **anon public** key
4. Abra `config.js` e cole:
   ```js
   window.ORBITA_CONFIG = {
     SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
     SUPABASE_ANON_KEY: "eyJ..."
   };
   ```
   > A chave **anon** pode ficar pública: quem protege seus dados são as regras RLS do `schema.sql` (cada usuário só vê o que é dele). **Nunca** use a chave `service_role`.

## 2. GitHub Pages (hospedagem) · ~3 min

1. Crie um repositório no GitHub (ex.: `orbita`). Pode ser público.
2. **Add file → Upload files** e envie `index.html`, `app.js`, `config.js` e a pasta `supabase/`. Commit.
3. **Settings → Pages** → *Source: Deploy from a branch* → branch `main`, pasta `/ (root)` → **Save**.
4. Em 1–2 minutos o site fica em `https://SEU-USUARIO.github.io/orbita/`.

## 3. Ligar o login ao endereço do site

No Supabase: **Authentication → URL Configuration**
- **Site URL**: `https://SEU-USUARIO.github.io/orbita/`
- **Redirect URLs**: adicione o mesmo endereço

Pronto: abra o site, clique em **Criar conta**, confirme o e-mail e entre.
Se tinha usado o modo local antes, vá em **Ajustes → Enviar dados locais para a nuvem**.

> Dica: para não precisar confirmar e-mail, em **Authentication → Providers → Email** desligue "Confirm email" (só faça isso se o site for só seu).

---

## De onde vêm os dados

| Dado | Fonte | Como |
|---|---|---|
| Selic, CDI, IPCA 12m, TR | Banco Central (SGS 432, 4389, 13522, 226) | ao vivo, cache de 6 h |
| Selic esperada por ano | Boletim Focus (API Olinda do BCB) | ao vivo |
| Taxas dos produtos do Inter | **app do Inter** | você confirma no app (lápis ✎) |

O Inter **não tem API pública de taxas**, e elas mudam toda semana. O catálogo vem com valores de referência/estimados (marcados em roxo "taxa estimada"). Abra o app → **Investir**, veja a taxa real e clique no lápis ✎ no Ranking ou em Ajustes. A partir daí o ranking usa o seu número e marca "confirmado". Viu um CDB melhor? **Ajustes → Produto do app** adiciona ao ranking.

Se o Banco Central estiver fora do ar, o site usa os valores de referência (bolinha amarela) e você pode ajustar manualmente em **Ajustes → Indicadores**.

## Como o cálculo funciona

- Cada aporte mensal é um "lote" com o próprio prazo de IR (22,5% até 180 dias → 15% após 720 dias); IOF nos primeiros 30 dias
- CDI segue a trajetória da Selic esperada pelo Focus (interpolada mês a mês)
- Tesouro: taxa B3 de 0,20% a.a. (Tesouro Selic isento até R$ 10 mil)
- Poupança: 0,5% a.m. + TR enquanto Selic > 8,5%
- Ranking: líquido a.a. (TIR) com penalidades para o que não combina com o objetivo: sem liquidez numa reserva, carência maior que o prazo, títulos que oscilam de preço se vendidos antes do vencimento

Os valores da carteira são **estimativas** baseadas na taxa atual. Para exatidão, informe o "valor atual do extrato" ao editar a aplicação.

> Ferramenta de apoio à decisão, não é recomendação de investimento.

## Editar / evoluir

Tudo está em `app.js`, organizado por seções (`motor financeiro`, `views`, `dashboards`…). Para mudar produtos padrão, edite `CATALOG_BASE`. Para mudar valores de referência, edite `IND_REF`.
