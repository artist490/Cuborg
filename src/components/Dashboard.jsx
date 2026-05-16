import React, { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import VaultList from "./VaultList";
import { useClipboardAutoWipe } from "./VaultItem";

const emptyDraft = {
  id: null,
  type: "password",
  title: "",
  subtitle: "",
  username: "",
  secret: "",
  url: "",
  notes: "",
  tags: [],
  favorite: false,
  archived: false,
};

const categoryTitles = {
  password: "Пароли",
  note: "Защищенные заметки",
  card: "Платежные карты",
  settings: "Настройки",
};

function getEmptyDraft(type) {
  return {
    ...emptyDraft,
    type,
  };
}

function tagsToInput(tags) {
  return Array.isArray(tags) ? tags.join(", ") : "";
}

function inputToTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function Field({ children, label }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function SecureField({ label, value, onCopy }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="secure-field">
      <span className="secure-field-label">{label}</span>
      <span className={`secure-field-value${revealed ? "" : " secure-mask"}`}>{value || " "}</span>
      <div className="secure-field-actions">
        <button className="button button-ghost" onClick={() => setRevealed((current) => !current)} type="button">
          {revealed ? "Скрыть" : "Показать"}
        </button>
        <button className="button button-ghost" disabled={!value} onClick={() => onCopy(value)} type="button">
          Копировать
        </button>
      </div>
    </div>
  );
}

function SettingsView({ onExportDatabase, onImportDatabase, onResetVault }) {
  const fileInputRef = useRef(null);

  function handleImport(event) {
    const file = event.target.files?.[0];

    if (file) {
      onImportDatabase(file);
      event.target.value = "";
    }
  }

  return (
    <section className="vault-detail-panel">
      <header className="vault-detail-header">
        <div className="vault-detail-title">
          <h2>Настройки vault</h2>
          <p>Экспорт и импорт работают с зашифрованным SQLite `.db` файлом.</p>
        </div>
      </header>
      <div className="vault-detail-body">
        <div className="settings-grid">
          <div className="settings-tile">
            <h3>Экспорт базы</h3>
            <p>Скачивает текущую encrypted SQLite базу без расшифровки содержимого.</p>
            <button className="button button-primary" onClick={onExportDatabase} type="button">
              Скачать .db
            </button>
          </div>
          <div className="settings-tile">
            <h3>Импорт базы</h3>
            <p>Заменяет локальную IndexedDB копию выбранным `.db` файлом.</p>
            <button className="button button-ghost" onClick={() => fileInputRef.current?.click()} type="button">
              Выбрать .db
            </button>
            <input
              accept=".db,application/vnd.sqlite3,application/octet-stream"
              className="sr-only"
              onChange={handleImport}
              ref={fileInputRef}
              type="file"
            />
          </div>
          <div className="settings-tile">
            <h3>Сброс</h3>
            <p>Удаляет локально сохраненную базу из IndexedDB и возвращает экран создания vault.</p>
            <button
              className="button button-danger"
              onClick={() => {
                if (window.confirm("Удалить локальный vault? Экспортируйте .db заранее, если он нужен.")) {
                  onResetVault();
                }
              }}
              type="button"
            >
              Сбросить vault
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function VaultEditor({
  activeCategory,
  draft,
  onArchiveItem,
  onCancel,
  onCopy,
  onDeleteItem,
  onFavoriteItem,
  onSaveItem,
  setDraft,
}) {
  const isExisting = Boolean(draft.id);
  const isNote = draft.type === "note";
  const isCard = draft.type === "card";

  function updateDraft(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!draft.title.trim()) {
      return;
    }

    onSaveItem({
      ...draft,
      type: activeCategory,
      tags: Array.isArray(draft.tags) ? draft.tags : inputToTags(draft.tagsInput ?? ""),
    });
  }

  return (
    <section className="vault-detail-panel">
      <header className="vault-detail-header">
        <div className="vault-detail-title">
          <h2>{isExisting ? draft.title || "Запись" : "Новая запись"}</h2>
          <p>{categoryTitles[activeCategory]}</p>
        </div>
        <div className="dashboard-actions">
          {isExisting && (
            <button className="button button-ghost" onClick={() => onFavoriteItem(draft.id, !draft.favorite)} type="button">
              {draft.favorite ? "Убрать ★" : "В избранное"}
            </button>
          )}
          <button className="button button-ghost" onClick={onCancel} type="button">
            Отмена
          </button>
        </div>
      </header>

      <div className="vault-detail-body">
        {isExisting && (
          <div className="detail-section">
            <h3 className="detail-section-title">Быстрый доступ</h3>
            <div className="detail-grid">
              <SecureField label={isCard ? "Номер / CVV" : isNote ? "Секрет" : "Пароль"} onCopy={onCopy} value={draft.secret} />
              <SecureField label="Логин / владелец" onCopy={onCopy} value={draft.username} />
            </div>
          </div>
        )}

        <form className="vault-editor" onSubmit={handleSubmit}>
          <div className="detail-grid">
            <Field label={isCard ? "Название карты" : "Название"}>
              <input className="input" onChange={(event) => updateDraft("title", event.target.value)} required value={draft.title} />
            </Field>
            <Field label={isCard ? "Банк / платежная система" : "Подпись"}>
              <input className="input" onChange={(event) => updateDraft("subtitle", event.target.value)} value={draft.subtitle} />
            </Field>
          </div>

          <div className="detail-grid">
            <Field label={isCard ? "Владелец" : isNote ? "Контекст" : "Логин"}>
              <input className="input" onChange={(event) => updateDraft("username", event.target.value)} value={draft.username} />
            </Field>
            <Field label={isCard ? "Номер / CVV / PIN" : isNote ? "Секретная строка" : "Пароль"}>
              <input
                className="input secure-mask"
                onChange={(event) => updateDraft("secret", event.target.value)}
                value={draft.secret}
              />
            </Field>
          </div>

          {!isNote && (
            <Field label={isCard ? "Ссылка на кабинет" : "URL"}>
              <input className="input" onChange={(event) => updateDraft("url", event.target.value)} type="url" value={draft.url} />
            </Field>
          )}

          <Field label="Заметки">
            <textarea className="textarea" onChange={(event) => updateDraft("notes", event.target.value)} value={draft.notes} />
          </Field>

          <Field label="Теги через запятую">
            <input
              className="input"
              onChange={(event) => updateDraft("tags", inputToTags(event.target.value))}
              value={tagsToInput(draft.tags)}
            />
          </Field>

          <div className="editor-actions">
            {isExisting && (
              <>
                <button className="button button-ghost" onClick={() => onArchiveItem(draft.id, !draft.archived)} type="button">
                  {draft.archived ? "Вернуть из архива" : "В архив"}
                </button>
                <button
                  className="button button-danger"
                  onClick={() => {
                    if (window.confirm("Удалить запись безвозвратно?")) {
                      onDeleteItem(draft.id);
                    }
                  }}
                  type="button"
                >
                  Удалить
                </button>
              </>
            )}
            <button className="button button-primary" type="submit">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default function Dashboard({
  activeCategory,
  error,
  includeArchived,
  isWorking,
  items,
  notice,
  onArchiveItem,
  onCategoryChange,
  onDeleteItem,
  onExportDatabase,
  onFavoriteItem,
  onImportDatabase,
  onLockVault,
  onResetVault,
  onSaveItem,
  onSearchChange,
  onSelectItem,
  onToggleArchived,
  search,
  selectedId,
  selectedItem,
}) {
  const [draft, setDraft] = useState(getEmptyDraft(activeCategory));
  const [isCreating, setIsCreating] = useState(false);
  const copyWithWipe = useClipboardAutoWipe();
  const counts = useMemo(
    () => ({
      password: activeCategory === "password" ? items.length : 0,
      note: activeCategory === "note" ? items.length : 0,
      card: activeCategory === "card" ? items.length : 0,
    }),
    [activeCategory, items.length],
  );

  useEffect(() => {
    if (selectedItem && activeCategory !== "settings") {
      setDraft(selectedItem);
      setIsCreating(false);
      return;
    }

    setDraft(getEmptyDraft(activeCategory));
  }, [activeCategory, selectedItem]);

  function handleAddItem() {
    setIsCreating(true);
    setDraft(getEmptyDraft(activeCategory));
  }

  function handleCategoryChange(category) {
    setIsCreating(false);
    onCategoryChange(category);
  }

  async function handleCopy(value) {
    await copyWithWipe(value, () => {});
  }

  const title = categoryTitles[activeCategory] ?? "Vault";
  const editorVisible = activeCategory !== "settings";

  return (
    <div className="dashboard">
      <Sidebar activeCategory={activeCategory} counts={counts} onCategoryChange={handleCategoryChange} onLockVault={onLockVault} />

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="dashboard-title-group">
            <h1 className="dashboard-title">{title}</h1>
            <p className="dashboard-subtitle">
              {isWorking ? "Выполняется операция..." : "Все чувствительные поля зашифрованы до записи в SQLite."}
            </p>
          </div>
          <div className="dashboard-actions">
            <button className="button button-ghost" onClick={onExportDatabase} type="button">
              Экспорт
            </button>
            <button className="button button-ghost" onClick={onLockVault} type="button">
              Lock
            </button>
          </div>
        </header>

        {activeCategory === "settings" ? (
          <SettingsView onExportDatabase={onExportDatabase} onImportDatabase={onImportDatabase} onResetVault={onResetVault} />
        ) : (
          <div className="dashboard-grid">
            <VaultList
              activeCategory={activeCategory}
              includeArchived={includeArchived}
              items={items}
              onAddItem={handleAddItem}
              onCopySecret={handleCopy}
              onSearchChange={onSearchChange}
              onSelectItem={onSelectItem}
              onToggleArchived={onToggleArchived}
              search={search}
              selectedId={selectedId}
            />
            {editorVisible && (
              <VaultEditor
                activeCategory={activeCategory}
                draft={draft}
                onArchiveItem={onArchiveItem}
                onCancel={() => {
                  setIsCreating(false);
                  setDraft(selectedItem ?? getEmptyDraft(activeCategory));
                }}
                onCopy={handleCopy}
                onDeleteItem={onDeleteItem}
                onFavoriteItem={onFavoriteItem}
                onSaveItem={onSaveItem}
                setDraft={setDraft}
              />
            )}
          </div>
        )}
      </section>

      {(notice || error) && (
        <div className="toast-stack" role="status">
          {notice && <div className="toast">{notice}</div>}
          {error && <div className="toast">{error}</div>}
        </div>
      )}
    </div>
  );
}
