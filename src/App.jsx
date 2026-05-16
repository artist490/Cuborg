import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuthScreen from "./components/AuthScreen";
import Dashboard from "./components/Dashboard";
import {
  createAuthVerifier,
  decryptString,
  encryptString,
  unlockWithVerifier,
} from "./crypto/cryptoEngine";
import {
  archiveVaultItem,
  closeVaultDatabase,
  createDownloadUrl,
  createVaultItem,
  deleteVaultItem,
  exportVaultDatabase,
  getAuthRecord,
  hasAuthRecord,
  importVaultDatabase,
  listVaultItems,
  openVaultDatabase,
  persistVaultDatabase,
  resetVaultDatabase,
  revokeDownloadUrl,
  saveAuthRecord,
  setVaultItemFavorite,
  updateVaultItem,
} from "./db/dbEngine";

const CATEGORY_TYPES = new Set(["password", "note", "card"]);
const AUTO_LOCK_MS = 5 * 60 * 1000;
const HIDDEN_LOCK_MS = 60 * 1000;

const initialVaultState = {
  status: "loading",
  mode: "login",
  db: null,
  key: null,
  authRecord: null,
  activeCategory: "password",
  search: "",
  includeArchived: false,
  items: [],
  selectedId: null,
  selectedItem: null,
  error: "",
  notice: "",
};

function getAuthMode(database) {
  return hasAuthRecord(database) ? "login" : "setup";
}

function getCategoryType(activeCategory) {
  return CATEGORY_TYPES.has(activeCategory) ? activeCategory : "password";
}

function itemMatchesSearch(item, search) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return [
    item.title,
    item.subtitle,
    item.username,
    item.url,
    item.notes,
    ...(item.tags ?? []),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedSearch));
}

async function encryptItemFields(item, key) {
  return {
    ...item,
    title: await encryptString(item.title.trim(), key),
    subtitle: item.subtitle ? await encryptString(item.subtitle.trim(), key) : "",
    username: item.username ? await encryptString(item.username.trim(), key) : "",
    secret: item.secret ? await encryptString(item.secret, key) : "",
    url: item.url ? await encryptString(item.url.trim(), key) : "",
    notes: item.notes ? await encryptString(item.notes, key) : "",
  };
}

async function decryptItemFields(item, key) {
  if (!item) {
    return null;
  }

  return {
    ...item,
    title: await decryptString(item.title, key),
    subtitle: item.subtitle ? await decryptString(item.subtitle, key) : "",
    username: item.username ? await decryptString(item.username, key) : "",
    secret: item.secret ? await decryptString(item.secret, key) : "",
    url: item.url ? await decryptString(item.url, key) : "",
    notes: item.notes ? await decryptString(item.notes, key) : "",
  };
}

async function decryptItemList(items, key) {
  const decryptedItems = await Promise.all(
    items.map(async (item) => {
      try {
        return await decryptItemFields(item, key);
      } catch {
        return {
          ...item,
          title: "Unreadable item",
          subtitle: "Decryption failed",
          username: "",
          secret: "",
          url: "",
          notes: "",
          decryptFailed: true,
        };
      }
    }),
  );

  return decryptedItems;
}

function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/vnd.sqlite3" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function clearClipboard() {
  if (!navigator.clipboard) {
    return;
  }

  try {
    await navigator.clipboard.writeText("");
  } catch {
    /* Browser focus and permission rules can block clipboard writes. */
  }
}

export default function App() {
  const [state, setState] = useState(initialVaultState);
  const dbRef = useRef(null);
  const keyRef = useRef(null);
  const viewRef = useRef({
    activeCategory: initialVaultState.activeCategory,
    search: initialVaultState.search,
    includeArchived: initialVaultState.includeArchived,
  });
  const downloadUrlRef = useRef("");
  const idleTimerRef = useRef(null);
  const hiddenTimerRef = useRef(null);

  const refreshItems = useCallback(async (override = {}) => {
    const database = override.db ?? dbRef.current;
    const key = override.key ?? keyRef.current;

    if (!database || !key) {
      return;
    }

    const activeCategory = override.activeCategory ?? viewRef.current.activeCategory;
    const search = override.search ?? viewRef.current.search;
    const includeArchived = override.includeArchived ?? viewRef.current.includeArchived;

    viewRef.current = {
      activeCategory,
      search,
      includeArchived,
    };

    const encryptedItems = listVaultItems(database, {
      type: getCategoryType(activeCategory),
      search: "",
      includeArchived,
    });
    const decryptedItems = (await decryptItemList(encryptedItems, key)).filter((item) => itemMatchesSearch(item, search));

    setState((current) => {
      const selectedStillExists = decryptedItems.some((item) => item.id === current.selectedId);
      const selectedId = override.selectedId ?? (selectedStillExists ? current.selectedId : decryptedItems[0]?.id ?? null);
      const selectedItem = decryptedItems.find((item) => item.id === selectedId) ?? null;

      return {
        ...current,
        activeCategory,
        search,
        includeArchived,
        items: decryptedItems,
        selectedId,
        selectedItem,
      };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const database = await openVaultDatabase();

        if (cancelled) {
          closeVaultDatabase(database);
          return;
        }

        dbRef.current = database;

        setState((current) => ({
          ...current,
          status: "locked",
          mode: getAuthMode(database),
          db: database,
          authRecord: getAuthRecord(database),
          error: "",
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          status: "error",
          error: error instanceof Error ? error.message : "Failed to load vault database.",
        }));
      }
    }

    boot();

    return () => {
      cancelled = true;
      closeVaultDatabase(dbRef.current);
      revokeDownloadUrl(downloadUrlRef.current);
    };
  }, []);

  const showNotice = useCallback((notice) => {
    setState((current) => ({ ...current, notice }));
    window.setTimeout(() => {
      setState((current) => (current.notice === notice ? { ...current, notice: "" } : current));
    }, 2800);
  }, []);

  const handleInitializeVault = useCallback(async (masterPassword) => {
    const database = dbRef.current;

    if (!database) {
      return;
    }

    setState((current) => ({ ...current, status: "working", error: "" }));

    try {
      const { salt, verifier, key } = await createAuthVerifier(masterPassword);

      saveAuthRecord(database, { salt, verifier });
      await persistVaultDatabase(database);
      keyRef.current = key;

      setState((current) => ({
        ...current,
        status: "unlocked",
        mode: "login",
        key,
        authRecord: getAuthRecord(database),
        error: "",
      }));

      await refreshItems({ db: database, key });
      showNotice("Vault initialized locally.");
    } catch (error) {
      setState((current) => ({
        ...current,
        status: "locked",
        error: error instanceof Error ? error.message : "Unable to initialize vault.",
      }));
    }
  }, [refreshItems, showNotice]);

  const handleUnlockVault = useCallback(async (masterPassword) => {
    const database = dbRef.current;

    if (!database) {
      setState((current) => ({ ...current, error: "Vault database is not loaded." }));
      return;
    }

    const authRecord = getAuthRecord(database);

    if (!authRecord) {
      setState((current) => ({ ...current, error: "Vault authentication record is missing." }));
      return;
    }

    setState((current) => ({ ...current, status: "working", error: "" }));

    try {
      const key = await unlockWithVerifier(masterPassword, authRecord.salt, authRecord.verifier);

      keyRef.current = key;

      setState((current) => ({
        ...current,
        status: "unlocked",
        key,
        authRecord,
        error: "",
      }));

      await refreshItems({ db: database, key });
      showNotice("Vault unlocked.");
    } catch {
      keyRef.current = null;
      setState((current) => ({
        ...current,
        status: "locked",
        key: null,
        error: "Неверный мастер-пароль.",
      }));
    }
  }, [refreshItems, showNotice]);

  const handleLockVault = useCallback((reason = "") => {
    keyRef.current = null;
    clearClipboard();
    window.clearTimeout(idleTimerRef.current);
    window.clearTimeout(hiddenTimerRef.current);
    viewRef.current = {
      activeCategory: initialVaultState.activeCategory,
      search: initialVaultState.search,
      includeArchived: initialVaultState.includeArchived,
    };
    setState((current) => ({
      ...current,
      status: "locked",
      key: null,
      items: [],
      selectedId: null,
      selectedItem: null,
      search: "",
      error: "",
      notice: reason,
    }));
  }, []);

  useEffect(() => {
    if (!state.key) {
      window.clearTimeout(idleTimerRef.current);
      window.clearTimeout(hiddenTimerRef.current);
      return undefined;
    }

    const armIdleTimer = () => {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        handleLockVault("Vault locked after inactivity.");
      }, AUTO_LOCK_MS);
    };

    const handleVisibilityChange = () => {
      window.clearTimeout(hiddenTimerRef.current);

      if (document.visibilityState === "hidden") {
        clearClipboard();
        hiddenTimerRef.current = window.setTimeout(() => {
          handleLockVault("Vault locked while the tab was away.");
        }, HIDDEN_LOCK_MS);
        return;
      }

      armIdleTimer();
    };

    const handlePageHide = () => {
      keyRef.current = null;
      clearClipboard();
    };

    const activityEvents = ["pointerdown", "keydown", "scroll", "touchstart"];

    activityEvents.forEach((eventName) => window.addEventListener(eventName, armIdleTimer, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    armIdleTimer();

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, armIdleTimer));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.clearTimeout(idleTimerRef.current);
      window.clearTimeout(hiddenTimerRef.current);
    };
  }, [handleLockVault, state.key]);

  const handleCategoryChange = useCallback(async (activeCategory) => {
    setState((current) => ({
      ...current,
      activeCategory,
      selectedId: null,
      selectedItem: null,
    }));
    viewRef.current = { ...viewRef.current, activeCategory };
    await refreshItems({ activeCategory, selectedId: null });
  }, [refreshItems]);

  const handleSearchChange = useCallback(async (search) => {
    setState((current) => ({ ...current, search }));
    viewRef.current = { ...viewRef.current, search };
    await refreshItems({ search });
  }, [refreshItems]);

  const handleArchivedToggle = useCallback(async (includeArchived) => {
    setState((current) => ({ ...current, includeArchived }));
    viewRef.current = { ...viewRef.current, includeArchived };
    await refreshItems({ includeArchived });
  }, [refreshItems]);

  const handleSelectItem = useCallback((id) => {
    setState((current) => ({
      ...current,
      selectedId: id,
      selectedItem: current.items.find((item) => item.id === id) ?? null,
    }));
  }, []);

  const handleSaveItem = useCallback(async (item) => {
    const database = dbRef.current;
    const key = keyRef.current;

    if (!database || !key) {
      return;
    }

    const payload = {
      ...item,
      type: getCategoryType(item.type ?? state.activeCategory),
    };

    setState((current) => ({ ...current, status: "working", error: "" }));

    try {
      const encryptedItem = await encryptItemFields(payload, key);
      let selectedId = item.id ?? null;

      if (item.id) {
        updateVaultItem(database, item.id, encryptedItem);
      } else {
        selectedId = createVaultItem(database, encryptedItem);
      }

      await persistVaultDatabase(database);
      setState((current) => ({ ...current, status: "unlocked" }));
      await refreshItems({ selectedId });
      showNotice("Saved locally.");
    } catch (error) {
      setState((current) => ({
        ...current,
        status: "unlocked",
        error: error instanceof Error ? error.message : "Unable to save item.",
      }));
    }
  }, [refreshItems, showNotice, state.activeCategory]);

  const handleDeleteItem = useCallback(async (id) => {
    const database = dbRef.current;

    if (!database) {
      return;
    }

    deleteVaultItem(database, id);
    await persistVaultDatabase(database);
    await refreshItems({ selectedId: null });
    showNotice("Deleted from local vault.");
  }, [refreshItems, showNotice]);

  const handleArchiveItem = useCallback(async (id, archived) => {
    const database = dbRef.current;

    if (!database) {
      return;
    }

    archiveVaultItem(database, id, archived);
    await persistVaultDatabase(database);
    await refreshItems({ selectedId: id });
    showNotice(archived ? "Item archived." : "Item restored.");
  }, [refreshItems, showNotice]);

  const handleFavoriteItem = useCallback(async (id, favorite) => {
    const database = dbRef.current;

    if (!database) {
      return;
    }

    setVaultItemFavorite(database, id, favorite);
    await persistVaultDatabase(database);
    await refreshItems({ selectedId: id });
  }, [refreshItems]);

  const handleExportDatabase = useCallback(() => {
    const database = dbRef.current;

    if (!database) {
      return;
    }

    downloadBytes(exportVaultDatabase(database), `personal-secure-vault-${new Date().toISOString().slice(0, 10)}.db`);
    showNotice("Encrypted database exported.");
  }, [showNotice]);

  const handleCreateDownloadUrl = useCallback(() => {
    const database = dbRef.current;

    if (!database) {
      return "";
    }

    revokeDownloadUrl(downloadUrlRef.current);
    downloadUrlRef.current = createDownloadUrl(database);
    return downloadUrlRef.current;
  }, []);

  const handleImportDatabase = useCallback(async (file) => {
    if (!file) {
      return;
    }

    setState((current) => ({ ...current, status: "working", error: "" }));

    try {
      const nextDatabase = await importVaultDatabase(file);

      closeVaultDatabase(dbRef.current);
      dbRef.current = nextDatabase;
      keyRef.current = null;
      clearClipboard();
      viewRef.current = {
        activeCategory: initialVaultState.activeCategory,
        search: initialVaultState.search,
        includeArchived: initialVaultState.includeArchived,
      };

      setState((current) => ({
        ...current,
        status: "locked",
        mode: getAuthMode(nextDatabase),
        db: nextDatabase,
        key: null,
        authRecord: getAuthRecord(nextDatabase),
        items: [],
        selectedId: null,
        selectedItem: null,
        error: "",
      }));

      showNotice("Database imported. Unlock it with its master password.");
    } catch (error) {
      setState((current) => ({
        ...current,
        status: current.key ? "unlocked" : "locked",
        error: error instanceof Error ? error.message : "Unable to import database.",
      }));
    }
  }, [showNotice]);

  const handleResetVault = useCallback(async () => {
    setState((current) => ({ ...current, status: "working", error: "" }));

    try {
      const nextDatabase = await resetVaultDatabase();

      closeVaultDatabase(dbRef.current);
      dbRef.current = nextDatabase;
      keyRef.current = null;
      clearClipboard();
      viewRef.current = {
        activeCategory: initialVaultState.activeCategory,
        search: initialVaultState.search,
        includeArchived: initialVaultState.includeArchived,
      };

      setState({
        ...initialVaultState,
        status: "locked",
        mode: "setup",
        db: nextDatabase,
      });

      showNotice("Local vault reset.");
    } catch (error) {
      setState((current) => ({
        ...current,
        status: current.key ? "unlocked" : "locked",
        error: error instanceof Error ? error.message : "Unable to reset vault.",
      }));
    }
  }, [showNotice]);

  const appActions = useMemo(
    () => ({
      initializeVault: handleInitializeVault,
      unlockVault: handleUnlockVault,
      lockVault: handleLockVault,
      changeCategory: handleCategoryChange,
      changeSearch: handleSearchChange,
      toggleArchived: handleArchivedToggle,
      selectItem: handleSelectItem,
      saveItem: handleSaveItem,
      deleteItem: handleDeleteItem,
      archiveItem: handleArchiveItem,
      favoriteItem: handleFavoriteItem,
      exportDatabase: handleExportDatabase,
      createDownloadUrl: handleCreateDownloadUrl,
      importDatabase: handleImportDatabase,
      resetVault: handleResetVault,
    }),
    [
      handleArchiveItem,
      handleArchivedToggle,
      handleCategoryChange,
      handleCreateDownloadUrl,
      handleDeleteItem,
      handleExportDatabase,
      handleFavoriteItem,
      handleImportDatabase,
      handleInitializeVault,
      handleLockVault,
      handleResetVault,
      handleSaveItem,
      handleSearchChange,
      handleSelectItem,
      handleUnlockVault,
    ],
  );

  if (!state.key) {
    return (
      <main className="app-shell">
        <AuthScreen
          error={state.error}
          isLoading={state.status === "loading" || state.status === "working"}
          mode={state.mode}
          onInitialize={appActions.initializeVault}
          onImport={appActions.importDatabase}
          onUnlock={appActions.unlockVault}
        />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Dashboard
        activeCategory={state.activeCategory}
        error={state.error}
        includeArchived={state.includeArchived}
        isWorking={state.status === "working"}
        items={state.items}
        notice={state.notice}
        search={state.search}
        selectedItem={state.selectedItem}
        selectedId={state.selectedId}
        onArchiveItem={appActions.archiveItem}
        onCategoryChange={appActions.changeCategory}
        onCreateDownloadUrl={appActions.createDownloadUrl}
        onDeleteItem={appActions.deleteItem}
        onExportDatabase={appActions.exportDatabase}
        onFavoriteItem={appActions.favoriteItem}
        onImportDatabase={appActions.importDatabase}
        onLockVault={appActions.lockVault}
        onResetVault={appActions.resetVault}
        onSaveItem={appActions.saveItem}
        onSearchChange={appActions.changeSearch}
        onSelectItem={appActions.selectItem}
        onToggleArchived={appActions.toggleArchived}
      />
    </main>
  );
}
