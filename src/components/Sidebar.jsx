import React from "react";

const categories = [
  { id: "password", label: "Пароли", icon: "⌘" },
  { id: "note", label: "Заметки", icon: "✎" },
  { id: "card", label: "Карты", icon: "▣" },
  { id: "settings", label: "Настройки", icon: "⚙" },
];

export default function Sidebar({ activeCategory, counts, onCategoryChange, onLockVault }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark" aria-hidden="true">SV</div>
        <div className="sidebar-brand-text">
          <p className="sidebar-brand-title">Secure Vault</p>
          <p className="sidebar-brand-subtitle">локальная база</p>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Разделы vault">
        {categories.map((category) => (
          <button
            className={`sidebar-link${activeCategory === category.id ? " is-active" : ""}`}
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            type="button"
          >
            <span className="sidebar-link-main">
              <span aria-hidden="true">{category.icon}</span>
              <span className="sidebar-link-label">{category.label}</span>
            </span>
            {category.id !== "settings" && <span className="sidebar-count">{counts[category.id] ?? 0}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="button button-ghost" onClick={onLockVault} type="button">
          Заблокировать
        </button>
      </div>
    </aside>
  );
}
