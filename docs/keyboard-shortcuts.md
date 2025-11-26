# Keyboard Shortcuts

## Global

- **Ctrl/Cmd + S**: Save current form (settings pages). Prevents browser save.
- **Ctrl/Cmd + N**: (Reserved) create new item in context — wire per screen as implemented.
- **Esc**: Close active modal/drawer (where handlers provided).
- **Ctrl/Cmd + K**: Command palette (if/when available) — not wired yet.

## Notes

- Shortcuts are scope-aware via `useGlobalShortcuts`; handlers only fire when enabled conditions are met.
- Browser defaults are prevented for Ctrl/Cmd + S.
- Arrow-key navigation remains native; per-list handlers can opt in via `useGlobalShortcuts`.
