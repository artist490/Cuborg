import React, { useMemo, useRef, useState } from "react";

function getPasswordStrength(password) {
  let score = 0;

  if (password.length >= 12) score += 25;
  if (password.length >= 18) score += 20;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 20;
  if (/\d/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 20;

  return Math.min(score, 100);
}

export default function AuthScreen({ error, isLoading, mode, onInitialize, onImport, onUnlock }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const fileInputRef = useRef(null);
  const isSetup = mode === "setup";
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  function handleSubmit(event) {
    event.preventDefault();

    if (!password) {
      return;
    }

    if (isSetup) {
      if (password !== confirmPassword) {
        return;
      }

      onInitialize(password);
      return;
    }

    onUnlock(password);
  }

  function handleImport(event) {
    const file = event.target.files?.[0];

    if (file) {
      onImport(file);
      event.target.value = "";
    }
  }

  const passwordsMismatch = isSetup && confirmPassword && password !== confirmPassword;
  const canSubmit = Boolean(password) && !passwordsMismatch && !isLoading;

  return (
    <section className="auth-screen" aria-labelledby="auth-title">
      <div className="auth-panel">
        <header className="auth-header">
          <div className="auth-mark" aria-hidden="true">SV</div>
          <div>
            <h1 className="auth-title" id="auth-title">
              {isSetup ? "Создание личного vault" : "Personal Secure Vault"}
            </h1>
            <p className="auth-copy">
              {isSetup
                ? "Мастер-пароль не сохраняется. Он только выводит ключ шифрования локально в браузере."
                : "Введите мастер-пароль, чтобы расшифровать локальную базу данных."}
            </p>
          </div>
        </header>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="master-password">Мастер-пароль</label>
            <div className="auth-password-wrap">
              <input
                autoComplete={isSetup ? "new-password" : "current-password"}
                autoFocus
                className="input"
                disabled={isLoading}
                id="master-password"
                minLength={isSetup ? 12 : undefined}
                onChange={(event) => setPassword(event.target.value)}
                type={isVisible ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={isVisible ? "Скрыть пароль" : "Показать пароль"}
                className="button button-ghost icon-button auth-reveal"
                disabled={isLoading}
                onClick={() => setIsVisible((value) => !value)}
                type="button"
              >
                {isVisible ? "◐" : "●"}
              </button>
            </div>
          </div>

          {isSetup && (
            <>
              <div className="field">
                <label htmlFor="confirm-password">Повторите пароль</label>
                <input
                  autoComplete="new-password"
                  className="input"
                  disabled={isLoading}
                  id="confirm-password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type={isVisible ? "text" : "password"}
                  value={confirmPassword}
                />
                {passwordsMismatch && <p className="field-hint">Пароли не совпадают.</p>}
              </div>
              <div className="auth-meter" aria-label="Надежность пароля">
                <div className="auth-meter-track">
                  <div className="auth-meter-fill" style={{ "--strength": `${strength}%` }} />
                </div>
              </div>
            </>
          )}

          {error && <div className="auth-error">{error}</div>}

          <div className="auth-actions">
            <button className="button button-primary" disabled={!canSubmit} type="submit">
              {isLoading ? "Подождите..." : isSetup ? "Создать vault" : "Разблокировать"}
            </button>
            <button
              className="button button-ghost"
              disabled={isLoading}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              Импорт .db
            </button>
          </div>

          <input
            accept=".db,application/vnd.sqlite3,application/octet-stream"
            className="sr-only"
            onChange={handleImport}
            ref={fileInputRef}
            type="file"
          />
        </form>

        <footer className="auth-footer">
          <span className="auth-offline-dot" aria-hidden="true" />
          <span>Offline only · Web Crypto · SQLite WASM</span>
        </footer>
      </div>
    </section>
  );
}
