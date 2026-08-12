# Relatório Início Turno — V2

Aplicação para consolidar mensagens de início de turno de múltiplas linhas em uma única visão operacional e gerar os relatórios completo e resumido para WhatsApp.

## Princípios da V2

- Motor separado do frontend: parsing e regras não dependem de React.
- Entidades antes de strings: máquina, setup, manutenção, ausência e seleção são dados estruturados.
- Coexistência não é conflito: uma TNL pode ter manutenção e setup simultaneamente quando os eventos são compatíveis.
- Revisão por exceção: o usuário só deve intervir quando a interpretação não for confiável.
- Mobile-first: fluxo pensado para uso rápido no início do turno.
- Dados reais fora do repositório público: fixtures versionadas são sintéticas.

## Stack

React + TypeScript + Vite + Vitest.

## Fluxo

```text
Mensagens do WhatsApp
        ↓
Message Splitter
        ↓
Normalização
        ↓
Detecção de seções
        ↓
Extração de entidades
        ↓
Classificação operacional
        ↓
Auditoria / revisão
        ↓
Snapshot do setor
        ↓
Relatório completo + resumido
```

## Rodar localmente

```bash
npm install
npm run dev
```

## Validar

```bash
npm test
npm run build
```

## Status

Fundação V2: intake, motor inicial, dashboard, contadores e geração dos dois relatórios.
