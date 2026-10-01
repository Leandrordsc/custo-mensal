- source_spec: `_bmad-output/planning-artifacts/DATA_MODEL.md`
  summary: Bloquear ciclos de reversao com mais de dois registros na camada de dominio/repository da Etapa 2.
  evidence: A Etapa 1 mantem triggers SQLite para autorreferencia e ciclo direto de dois registros; ciclos maiores exigem regra de dominio antes de persistir reversoes.

- source_spec: `_bmad-output/implementation-artifacts/spec-evoluir-controle-financeiro-pessoal.md`
  summary: Adicionar testes browser/DOM para navegação entre Dashboard, Custos, Cartões, Investimentos e FIIs.
  evidence: A suíte atual valida helpers financeiros, staging e SSR inicial, mas não clica nas abas client-side para verificar totais e datas visíveis após interação.

- source_spec: none
  summary: Conectar a importacao XLSX e definir a exportacao pela interface do sistema.
  evidence: A integracao de arquivos e um objetivo independente das correcoes de consistencia da interface e foi adiada por escolha do usuario.

- source_spec: `_bmad-output/implementation-artifacts/spec-consistencia-interface-busca-filtros.md`
  summary: Adicionar testes automatizados de interacao React/browser para busca, navegacao, ano compartilhado, periodo de ativos e respostas fora de ordem.
  evidence: A suite atual cobre helpers, APIs, SSR e integracao estrutural, mas o repositorio nao possui harness DOM/browser para exercitar os controles client-side; a verificacao automatizada atual nao observaria uma regressao de wiring mantendo os mesmos textos-fonte.

- source_spec: `_bmad-output/implementation-artifacts/spec-importacao-xlsx-detalhada.md`
  summary: Endurecer o parser XLSX nativo para variações genéricas fora da planilha atual, como ZIP64, células mescladas, sheets ocultas e layouts anuais alternativos.
  evidence: A etapa atual entrega staging detalhado para `referencias/Custo Mensal.xlsx`; revisões levantaram edge cases de XLSX amplo que não são necessários para a planilha fonte atual, mas merecem etapa própria antes de aceitar arquivos arbitrários.
