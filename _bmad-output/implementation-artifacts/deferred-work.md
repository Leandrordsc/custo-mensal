- source_spec: `_bmad-output/planning-artifacts/DATA_MODEL.md`
  summary: Bloquear ciclos de reversao com mais de dois registros na camada de dominio/repository da Etapa 2.
  evidence: A Etapa 1 mantem triggers SQLite para autorreferencia e ciclo direto de dois registros; ciclos maiores exigem regra de dominio antes de persistir reversoes.

- source_spec: `_bmad-output/implementation-artifacts/spec-evoluir-controle-financeiro-pessoal.md`
  summary: Implementar parser XLSX completo para preservar linhas/categorias detalhadas de 2021-2025, não apenas totais mensais agregados.
  evidence: A implementação atual preserva os totais históricos desses anos como staging agregado, mas não captura granularidade por categoria sem um parser completo da planilha.

- source_spec: `_bmad-output/implementation-artifacts/spec-evoluir-controle-financeiro-pessoal.md`
  summary: Adicionar testes browser/DOM para navegação entre Dashboard, Custos, Cartões, Investimentos e FIIs.
  evidence: A suíte atual valida helpers financeiros, staging e SSR inicial, mas não clica nas abas client-side para verificar totais e datas visíveis após interação.
