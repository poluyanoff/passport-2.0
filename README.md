# Паспорт дизайн-задачи

React-приложение для описания дизайн-задач. Пользователь последовательно заполняет паспорт, получает формальные проверки полей и AI-рекомендации перед отправкой описания в эпик.

Рабочая версия: <https://passport-2-0.poluyanoff-kos.workers.dev>

## Быстрый старт на новой машине

Нужны Git, Node.js **22+** и npm.

```sh
git clone https://github.com/poluyanoff/passport-2.0.git
cd passport-2.0
npm ci
cp .env.example .env
npm run dev
```

Откройте адрес, который напечатает терминал. Для локального AI-режима заполните `OPENAI_API_KEY` в `.env`; файл не попадает в Git.

## Основные команды

| Команда | Назначение |
| --- | --- |
| `npm run dev` | Локальный сервер, сборка с watch и API проверки. |
| `npm run build` | Production-сборка в `dist/`. |
| `npm run review:check` | Проверка локальных правил на тестовых паспортах. |
| `npm run worker:check` | Сборка и dry-run Cloudflare Worker. |
| `npm start` | Запуск собранной версии с Node API. |

## Как публикуются изменения

`main` — единственный источник production-версии.

```text
локальная ветка → git push origin main → GitHub Actions → Cloudflare Worker → production
```

GitHub Actions сначала запускает `npm run review:check` и `npm run build`; только затем публикует Worker. Если проверка или сборка упали, текущий production не меняется.

Подробности:

- [Архитектура и взаимосвязи](docs/ARCHITECTURE.md)
- [Локальная разработка, секреты и деплой](docs/OPERATIONS.md)

## Секреты

Секреты никогда не коммитятся. `.env` и `.dev.vars` игнорируются Git.

- `OPENAI_API_KEY` хранится в Cloudflare как Worker secret и локально — в `.env`/`.dev.vars`.
- `CLOUDFLARE_API_TOKEN` и `CLOUDFLARE_ACCOUNT_ID` хранятся только в GitHub Actions Secrets и нужны исключительно для автодеплоя.
