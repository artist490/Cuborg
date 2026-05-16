# Personal Secure Vault

Локальный offline-first менеджер паролей и приватных данных. Приложение работает в браузере, использует React, Vite, Web Crypto API и SQLite через WebAssembly (`sql.js`).

Главная идея: чувствительные поля шифруются до записи в SQLite. База хранится локально в IndexedDB и может экспортироваться/импортироваться как сырой зашифрованный `.db` файл.

## Возможности

- Полностью локальная работа без серверной части
- PWA-архитектура
- React functional components и hooks
- Чистый CSS без Tailwind, Bootstrap, shadcn/ui и других UI-фреймворков
- SQLite внутри браузера через WASM (`sql.js`)
- Шифрование чувствительных полей через AES-GCM
- Уникальный 12-byte IV для каждого зашифрованного значения
- Вывод ключа из мастер-пароля через PBKDF2
- Проверка мастер-пароля через `system_auth` и зашифрованную строку `VAULT_OK`
- Сохранение базы в IndexedDB
- Экспорт/импорт зашифрованной `.db` базы
- Автоочистка clipboard после копирования
- Автоблокировка vault при бездействии
- Блокировка при длительном уходе со вкладки
- Content Security Policy для ограничения внешних источников

## Быстрый старт

Установить зависимости:

```bash
npm install
```

Запустить режим разработки:

```bash
npm run dev
```

Откройте локальный адрес, который покажет Vite. Обычно это:

```text
http://localhost:5173/
```

Собрать production-версию:

```bash
npm run build
```

Предпросмотр production-сборки:

```bash
npm run preview
```

## Запуск на Windows

В проекте есть два `.bat` файла:

- `install-and-run.bat` — устанавливает зависимости с retry-настройками npm и запускает Vite.
- `run-vault.bat` — запускает приложение, если зависимости уже установлены.

Если `npm install` падает из-за VPN или нестабильной сети, переключите VPN-сервер и запустите `install-and-run.bat` снова.

## Модель безопасности

Это локальный персональный vault, а не облачный менеджер паролей.

### Криптография

- Key derivation: PBKDF2
- Hash: SHA-256
- Iterations: 100,000
- Encryption: AES-GCM
- Key length: 256-bit
- IV: случайный 12-byte IV на каждое шифрование
- Формат хранения: `base64(iv).base64(ciphertext)`
- Проверка входа: расшифровка `VAULT_OK` из таблицы `system_auth`

### Что защищается

- Чувствительные поля шифруются до записи в SQLite.
- Мастер-пароль не сохраняется.
- AES-ключ не сохраняется и существует только в памяти во время unlocked-сессии.
- Экспортированный `.db` файл содержит зашифрованные значения.
- Clipboard очищается после копирования и при блокировке vault.
- Vault автоматически блокируется при бездействии.

### Что не защищается

Приложение не защищает от:

- вредоносного ПО на устройстве
- опасных браузерных расширений
- скомпрометированного браузера
- keylogger-ов
- физического доступа к уже разблокированной сессии
- скриншотов и записи экрана
- слабого или повторно используемого мастер-пароля

Если мастер-пароль потерян, восстановить vault невозможно.

## Структура проекта

```text
src/
  components/
    AuthScreen.jsx
    Dashboard.jsx
    Sidebar.jsx
    VaultItem.jsx
    VaultList.jsx
  crypto/
    cryptoEngine.js
  db/
    dbEngine.js
  styles/
    index.css
    auth.css
    dashboard.css
  App.jsx
  main.jsx
```

## Основные файлы

- `src/crypto/cryptoEngine.js` — PBKDF2, AES-GCM, salt/IV helpers, auth verifier.
- `src/db/dbEngine.js` — загрузка `sql.js`, IndexedDB persistence, миграции, SQL-запросы.
- `src/App.jsx` — жизненный цикл vault, unlock/lock, CRUD, import/export.
- `src/components/` — интерфейс приложения.
- `src/styles/` — чистый CSS-дизайн без UI-фреймворков.
- `public/sw.js` — service worker для PWA.

## Offline/PWA поведение

Service worker кэширует только app shell и статические build assets. `.db` файлы намеренно не кэшируются.

## Перед публикацией на GitHub

Проверить сборку:

```bash
npm run build
```

Не коммитить:

- `node_modules/`
- `dist/`
- экспортированные `.db` файлы
- локальные `.env` файлы

Эти файлы уже добавлены в `.gitignore`.

## Публикация на GitHub

```bash
git init
git add .
git commit -m "Initial secure vault app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/personal-secure-vault.git
git push -u origin main
```

## Лицензия

MIT
