import React from "react";
import VaultItem from "./VaultItem";

export default function VaultList({
  activeCategory,
  includeArchived,
  items,
  onAddItem,
  onCopySecret,
  onSearchChange,
  onSelectItem,
  onToggleArchived,
  search,
  selectedId,
}) {
  return (
    <section className="vault-list-panel" aria-label="Список записей">
      <div className="vault-toolbar">
        <div className="vault-search-row">
          <input
            className="input"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Поиск по расшифрованным данным"
            type="search"
            value={search}
          />
          <button className="button button-primary icon-button" onClick={onAddItem} title="Новая запись" type="button">
            +
          </button>
        </div>
        <div className="vault-filter-row">
          <div className="segmented" role="group" aria-label="Фильтр архива">
            <button className={!includeArchived ? "is-active" : ""} onClick={() => onToggleArchived(false)} type="button">
              Активные
            </button>
            <button className={includeArchived ? "is-active" : ""} onClick={() => onToggleArchived(true)} type="button">
              Все
            </button>
          </div>
          <span className="status-pill">{items.length} · {activeCategory}</span>
        </div>
      </div>

      <div className="vault-list">
        {items.length === 0 ? (
          <div className="vault-empty">
            <div>
              <strong>Записей нет</strong>
              <span>Создайте первую локально зашифрованную запись.</span>
            </div>
          </div>
        ) : (
          items.map((item) => (
            <VaultItem
              isSelected={selectedId === item.id}
              item={item}
              key={item.id}
              onCopy={onCopySecret}
              onSelect={onSelectItem}
            />
          ))
        )}
      </div>
    </section>
  );
}
