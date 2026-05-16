import React, { useEffect, useRef, useState } from "react";

export function useClipboardAutoWipe(timeoutMs = 20_000) {
  const timerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return async function copyWithWipe(value, onDone) {
    if (!value || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(value);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      try {
        await navigator.clipboard.writeText("");
      } catch {
        /* Clipboard permissions can change after the user leaves the tab. */
      }
    }, timeoutMs);
    onDone?.();
  };
}

export default function VaultItem({ item, isSelected, onCopy, onSelect }) {
  const [isRevealed, setIsRevealed] = useState(false);
  const subtitle = item.subtitle || item.username || item.url || "Без подписи";

  return (
    <div
      className={`vault-row${isSelected ? " is-selected" : ""}`}
      onClick={() => onSelect(item.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(item.id);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <span className="vault-row-content">
        <span className="vault-row-title">
          <span>{item.title}</span>
          {item.favorite && <span className="status-pill">★</span>}
        </span>
        <span className="vault-row-meta">
          <span>{subtitle}</span>
          {item.secret && (
            <span
              className={isRevealed ? "" : "secure-mask"}
              onMouseEnter={() => setIsRevealed(true)}
              onMouseLeave={() => setIsRevealed(false)}
            >
              {item.secret}
            </span>
          )}
        </span>
      </span>
      <span className="vault-row-actions">
        {item.secret && (
          <button
            className="button button-ghost icon-button"
            onClick={(event) => {
              event.stopPropagation();
              onCopy(item.secret);
            }}
            title="Скопировать секрет"
            type="button"
          >
            ⧉
          </button>
        )}
      </span>
    </div>
  );
}
