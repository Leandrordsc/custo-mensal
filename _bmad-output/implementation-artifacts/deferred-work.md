- source_spec: `_bmad-output/planning-artifacts/DATA_MODEL.md`
  summary: Bloquear ciclos de reversao com mais de dois registros na camada de dominio/repository da Etapa 2.
  evidence: A Etapa 1 mantem triggers SQLite para autorreferencia e ciclo direto de dois registros; ciclos maiores exigem regra de dominio antes de persistir reversoes.

- source_spec: `_bmad-output/implementation-artifacts/spec-evoluir-controle-financeiro-pessoal.md`
  summary: Adicionar testes browser/DOM para navegação entre Dashboard, Custos, Cartões, Investimentos e FIIs.
  evidence: A suíte atual valida helpers financeiros, staging e SSR inicial, mas não clica nas abas client-side para verificar totais e datas visíveis após interação.

- source_spec: `_bmad-output/implementation-artifacts/spec-importacao-xlsx-detalhada.md`
  summary: Endurecer o parser XLSX nativo para variações genéricas fora da planilha atual, como ZIP64, células mescladas, sheets ocultas e layouts anuais alternativos.
  evidence: A etapa atual entrega staging detalhado para `referencias/Custo Mensal.xlsx`; revisões levantaram edge cases de XLSX amplo que não são necessários para a planilha fonte atual, mas merecem etapa própria antes de aceitar arquivos arbitrários.
