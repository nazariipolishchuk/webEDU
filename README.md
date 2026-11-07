# Web-програмування – лабораторні роботи

Студент: Поліщук Назарій, група ПЗ-2404

| Робота | Теґ   | Тека       | Тема                                        |
|--------|-------|------------|---------------------------------------------|
| ЛР 1   | –     | `web_lab1` | Засоби побудови веб-сторінок                |
| ЛР 2   | lab02 | `web_lab2` | Flexbox, Grid, адаптивна верстка            |
| ЛР 3   | lab03 | `web_lab3` | JavaScript: основи мови, DOM і події        |
| ЛР 4   | lab04 | `web_lab4` | Асинхронний JavaScript, Fetch API, REST API |
| ЛР 5   | lab05 | `web_lab5` | Node.js, npm, Git, Vite, Sass, PostCSS      |
| ЛР 6   | lab06 | `web_lab6` | TypeScript: типи, інтерфейси, generic-типи  |

ЛР 3 відкривається без сервера: `web_lab3/index.html` (каталог),
`web_lab3/tasks.html` (власні реалізації), `web_lab3/strict.html` (строгий режим).

ЛР 4 відкривається лише через локальний HTTP-сервер:

```
cd web_lab4
python -m http.server 8080
```

`http://localhost:8080/api.html` (публікації), `http://localhost:8080/network.html` (заміри та CORS).

ЛР 5 – застосунок ЛР 4, зібраний Vite 8 зі стилями Sass і Autoprefixer. Потрібен Node.js 26 (`.nvmrc`):

```
cd web_lab5
npm install
npm run dev          # сервер розробки, http://localhost:5173
npm run build        # промислова збірка в dist/
npm run preview      # перегляд dist/, http://localhost:4173
npm run lint         # ESLint; npm run format – Prettier
```

ЛР 6 – застосунок ЛР 5, переведений на TypeScript 6 у строгому режимі (варіант 2: `getJson<T>(url, guard)`
повертає `Promise<Result<T, ApiError>>`, захисники типу для кожної відповіді API):

```
cd web_lab6
npm install
npm run dev          # сервер розробки, http://localhost:5173
npm run typecheck    # tsc -b --noEmit: перевірка типів застосунку і vite.config.ts
npm run build        # tsc -b && vite build, результат у dist/
npm run lint         # ESLint з typescript-eslint (recommendedTypeChecked)
```
