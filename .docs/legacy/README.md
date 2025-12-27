# Legacy Documents

このフォルダには、**Azure ベースのアーキテクチャ計画書**が含まれています。

## 非推奨の理由

2024-12-17 に、コスト最適化のため以下の方針変更を行いました:

| 変更前 | 変更後 |
|--------|--------|
| Azure Cosmos DB | Turso Database |
| Azure Functions | Cloudflare Workers |
| Azure Blob Storage | Cloudflare R2 |
| Azure AI Search | Gemini File Search API |

## 新しい計画書

- `/docs/cloudflare-turso-architecture.md` - 新アーキテクチャ設計
- `/docs/gemini-rag-implementation-plan.md` - Gemini RAG実装計画

## このフォルダの内容

| ファイル | 内容 |
|---------|------|
| 00_rag-quickstart.md | Azure AI Search RAG クイックスタート |
| 04_technical-requirements.md | Azure 技術要件 |
| 05_question-generation-plan.md | Azure AI Search 問題生成計画 |
| 06_ai-rag-question-generation-guide.md | Azure RAG 詳細ガイド |
| 08_complete-release-roadmap.md | Azure インフラ含むロードマップ |
| Plan/ | Azure デプロイ週次計画 |

---

_移動日: 2024-12-17_
