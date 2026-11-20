# Разработка и эксплуатация

## Обычный рабочий цикл

1. Заберите изменения: `git pull origin main`.
2. Создайте ветку для доработки: `git switch -c feature/короткое-имя`.
3. Запустите `npm run dev` и внесите изменения.
4. Перед коммитом выполните `npm run review:check` и `npm run build`.
5. Закоммитьте изменения, слейте их в `main` и отправьте `git push origin main`.
6. Откройте вкладку **Actions** в GitHub и дождитесь зелёного `Deploy production`.

Для маленьких согласованных правок допускается работать прямо в `main`, но перед началом всегда делайте `git pull origin main`.

## Настройка на новой машине

```sh
git clone https://github.com/poluyanoff/passport-2.0.git
cd passport-2.0
npm ci
cp .env.example .env
npm run review:check
npm run dev
```

Минимальный локальный режим работает с `AI_PROVIDER=mock`. Для настоящей AI-проверки в `.env` задайте:

```dotenv
AI_PROVIDER=openai
OPENAI_MODEL=gpt-4.1-mini
OPENAI_API_KEY=ваш_ключ
```

В правом нижнем углу доступна служебная панель примеров: она содержит хороший пример, пример для формального fallback, пример для AI-проверки и «Экстремальные данные» для проверки перегруженных сценариев. После выбора доступен сброс. Временно панель включена и в production-сборку; при необходимости её можно скрыть, условно не рендеря `PassportExampleDial` в `screens/main.js`.

Не копируйте `.env` в Git, чат или frontend-код.

## Production и автодеплой

Production URL: <https://passport-2-0.poluyanoff-kos.workers.dev>

Workflow `.github/workflows/deploy.yml` запускается при каждом пуше в `main` или вручную из GitHub Actions. Он использует Node 22, выполняет `npm ci`, проверяет правила, собирает `dist/` и запускает `wrangler deploy`.

В GitHub repository secrets должны существовать:

| Secret | Назначение |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Ограниченный токен Cloudflare для публикации Worker. |
| `CLOUDFLARE_ACCOUNT_ID` | ID Cloudflare-аккаунта. |

В Cloudflare Worker secret должен существовать:

| Secret | Назначение |
| --- | --- |
| `OPENAI_API_KEY` | Ключ, который Worker передаёт OpenAI. |

Никогда не заменяйте `OPENAI_API_KEY` значением в `wrangler.jsonc`: конфигурация коммитится в Git. Для обновления секрета локально выполните `npx wrangler secret put OPENAI_API_KEY` из корня проекта.

## Проверка после релиза

```sh
curl --fail https://passport-2-0.poluyanoff-kos.workers.dev/health
```

Ожидаемый ответ содержит `status: "ok"`. В GitHub Actions должна быть зелёная задача `Check and deploy`.

## Частые проблемы

| Симптом | Что проверить |
| --- | --- |
| Пуш не запускает деплой | Ветка называется `main`, workflow лежит в `.github/workflows/deploy.yml`, secrets добавлены в репозиторий. |
| Worker не публикуется из CI | `CLOUDFLARE_API_TOKEN` не истёк и имеет права Edit Cloudflare Workers только для нужного аккаунта. |
| AI возвращает fallback | Проверьте баланс OpenAI, секрет `OPENAI_API_KEY` и `AI_PROVIDER=openai` в `wrangler.jsonc`. Приложение продолжит работать на локальных правилах. |
| Локально нет AI | Проверьте `.env`, перезапустите `npm run dev`. |
| `wrangler` требует другую Node | Используйте Node 22 или новее. |
| Изменения не видны в production | Убедитесь, что Action завершился успешно и смотрите URL Worker, а не старый localhost. |

## Что не нужно синхронизировать вручную

- `node_modules/` и `dist/` генерируются и не хранятся в Git.
- `.env` и `.dev.vars` содержат секреты и не должны переезжать между машинами через репозиторий.
- GitHub и Cloudflare не являются отдельными версиями кода: GitHub `main` разворачивается в Cloudflare автоматически.

