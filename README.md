# 🔐 Personal Secure Vault

**Personal Secure Vault** — это полностью локальный менеджер паролей и приватных данных, который работает прямо в браузере.

Он не отправляет данные на сервер, не требует аккаунта и хранит базу только на вашем устройстве. Чувствительные поля шифруются **до записи в SQLite**, а сама база может быть экспортирована как обычный зашифрованный `.db` файл.

> 🧠 Коротко: это offline-first PWA vault на **React + Web Crypto API + SQLite WASM**.

---

## ✨ Что умеет

- 🔒 **Локальное шифрование** через Web Crypto API
- 🧬 **PBKDF2 + SHA-256** для вывода ключа из мастер-пароля
- 🛡️ **AES-GCM 256-bit** для шифрования данных
- 🎲 Уникальный **12-byte IV** для каждого зашифрованного значения
- 🗄️ **SQLite внутри браузера** через WebAssembly (`sql.js`)
- 💾 Сохранение базы в **IndexedDB**
- 📤 Экспорт зашифрованной базы в `.db`
- 📥 Импорт `.db` обратно в приложение
- 🧹 Автоочистка clipboard после копирования
- ⏱️ Автоблокировка при бездействии
- 👁️ Блокировка при длительном уходе со вкладки
- 📵 Полностью offline-first подход
- 🎨 Чистый CSS без UI-фреймворков
- ⚛️ React functional components + hooks
- 📱 PWA-структура

---

## 🖼️ Скриншоты

> Пока скриншоты не добавлены в репозиторий.  
> Рекомендуемые файлы:

```text
docs/screenshots/auth.png
docs/screenshots/dashboard.png
docs/screenshots/settings.png
```

После добавления можно вставить:

```md
![Auth screen](docs/screenshots/auth.png)
![Dashboard](docs/screenshots/dashboard.png)
![Settings](docs/screenshots/settings.png)
```

---

## 🚀 Быстрый старт

### 1. Установить зависимости

```bash
npm install
```

### 2. Запустить приложение

```bash
npm run dev
```

После запуска Vite покажет локальный адрес. Обычно:

```text
http://localhost:5173/
```

### 3. Собрать production-версию

```bash
npm run build
```

### 4. Посмотреть production-сборку

```bash
npm run preview
```

---

## 🪟 Запуск на Windows

Для удобства есть два `.bat` файла:

| Файл | Назначение |
|---|---|
| `install-and-run.bat` | Устанавливает зависимости и запускает приложение |
| `run-vault.bat` | Запускает приложение, если зависимости уже установлены |

Если `npm install` падает из-за VPN или нестабильной сети:

1. Переключите VPN-сервер.
2. Запустите `install-and-run.bat` снова.
3. Или выполните вручную:

```bash
npm install --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000
```

---

## 🔐 Как работает безопасность

Приложение построено вокруг простой идеи:

> **SQLite хранит только зашифрованные чувствительные данные.**

Мастер-пароль не сохраняется. Из него в памяти браузера выводится AES-ключ. Этот ключ используется для расшифровки и шифрования данных только во время разблокированной сессии.

---

## 🧬 Криптографическая схема

### 🔑 Вывод ключа

Из мастер-пароля создается AES-ключ:

```text
PBKDF2
Hash: SHA-256
Iterations: 100,000
Key length: 256-bit
Salt: unique random salt
```

### 🛡️ Шифрование данных

Каждое чувствительное поле шифруется отдельно:

```text
AES-GCM
Key: 256-bit
IV: random 12 bytes per encryption
```

### 📦 Формат хранения

Зашифрованные значения сохраняются в SQLite как строка:

```text
IV_in_Base64.Ciphertext_in_Base64
```

Пример формата:

```text
MDEyMzQ1Njc4OWFi.Y2lwaGVydGV4dA==
```

### ✅ Проверка мастер-пароля

В SQLite есть таблица `system_auth`.

Она хранит:

- salt
- encrypted verifier

Verifier — это строка:

```text
VAULT_OK
```

При входе приложение пытается расшифровать `VAULT_OK`. Если расшифровка успешна — пароль правильный. Если нет — доступ запрещен.

---

## 🗄️ Где хранятся данные

Данные хранятся локально:

```text
Browser IndexedDB
└── encrypted SQLite .db
```

При экспорте вы получаете обычный `.db` файл, но чувствительные поля внутри остаются зашифрованными.

---

## 🧱 Архитектура проекта

```text
src/
  components/
    AuthScreen.jsx      # экран создания/разблокировки vault
    Dashboard.jsx       # основная рабочая область
    Sidebar.jsx         # навигация по категориям
    VaultList.jsx       # список записей и поиск
    VaultItem.jsx       # строка записи, copy-to-clipboard

  crypto/
    cryptoEngine.js     # PBKDF2, AES-GCM, salt, IV, verifier

  db/
    dbEngine.js         # sql.js, SQLite, IndexedDB, import/export

  styles/
    index.css           # reset, variables, global UI primitives
    auth.css            # экран авторизации
    dashboard.css       # layout, sidebar, list, editor

  App.jsx               # lifecycle, unlock/lock, CRUD, import/export
  main.jsx              # React entrypoint + service worker registration
```

---

## 🧩 Основные технологии

| Область | Технология |
|---|---|
| Frontend | React |
| Build tool | Vite |
| Styling | Pure CSS |
| Browser database | SQLite WASM через `sql.js` |
| Local storage | IndexedDB |
| Crypto | Web Crypto API |
| PWA | Manifest + Service Worker |

---

## 🛡️ Что защищается

✅ Чувствительные поля шифруются до записи в SQLite  
✅ Мастер-пароль не сохраняется  
✅ AES-ключ не сохраняется  
✅ Экспортированный `.db` остается зашифрованным  
✅ Clipboard очищается после копирования  
✅ Vault блокируется при бездействии  
✅ Vault блокируется при длительном уходе со вкладки  
✅ Service worker не кэширует `.db` файлы  
✅ CSP ограничивает внешние источники  

---

## ⚠️ Чего приложение не может защитить

Важно понимать границы безопасности.

Приложение **не защищает** от:

- 🦠 вредоносного ПО на устройстве
- 🧩 опасных браузерных расширений
- ⌨️ keylogger-ов
- 📸 скриншотов и записи экрана
- 👤 физического доступа к уже разблокированной сессии
- 🌐 скомпрометированного браузера
- 🔑 слабого мастер-пароля

Если мастер-пароль потерян, восстановить vault невозможно.

---

## 📵 Offline-first

Приложение спроектировано для локальной работы.

Service worker кэширует:

- app shell
- JS/CSS assets
- WASM assets
- manifest/icon

Service worker **не кэширует**:

- `.db`
- экспортированные базы
- произвольные пользовательские файлы

---

## 🧪 Проверка перед публикацией

```bash
npm install
npm run build
```

Если build прошел успешно, проект готов к публикации.

---

## 🚫 Что не нужно коммитить

Уже добавлено в `.gitignore`:

```text
node_modules/
dist/
*.db
*.sqlite
*.sqlite3
.env
.env.*
```

---

## 🏷️ Рекомендуемые GitHub Topics

Добавьте эти topics в настройках репозитория:

```text
password-manager
vault
web-crypto
sqlite
sqljs
react
vite
pwa
offline-first
encryption
aes-gcm
pbkdf2
privacy
cybersecurity
local-first
indexeddb
```

Это поможет людям находить проект через GitHub topics и поиск.

---

## 🗺️ Roadmap

Идеи для будущих улучшений:

- [ ] Генератор надежных паролей
- [ ] Оценка надежности сохраненных паролей
- [ ] Импорт из CSV
- [ ] Экспорт выбранных записей
- [ ] Автоматическая очистка decrypted state после закрытия редактора
- [ ] Дополнительный encrypted search index
- [ ] GitHub Pages demo
- [ ] Поддержка светлой темы
- [ ] Локальная проверка повторяющихся паролей
- [ ] Recovery warning screen перед созданием vault

---

## 🤝 Вклад в проект

Pull requests приветствуются.

Перед отправкой изменений:

```bash
npm run build
```

Для security-related изменений желательно описывать:

- какую угрозу изменение закрывает
- какие данные затрагиваются
- меняется ли формат базы
- нужна ли миграция

---

## 📄 Лицензия

MIT. Подробнее см. [LICENSE](LICENSE).

---

## ⭐ Если проект полезен

Поставьте ⭐ на GitHub — это помогает проекту появляться чаще в поиске и рекомендациях.
