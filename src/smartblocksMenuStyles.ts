const smartblocksMenuStyles = `
.roamjs-smartblocks-picker {
  --smartblocks-menu-width: min(400px, calc(100vw - 24px));
  display: grid; grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  width: var(--smartblocks-menu-width); background: white; color: #394b59;
  height: min(380px, calc(100vh - 24px));
  height: min(380px, calc(100dvh - 24px));
  border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
  overflow: hidden; font-size: 14px;
}
.roamjs-smartblocks-picker.is-preview-open {
  width: min(760px, calc(100vw - 24px));
  grid-template-columns: var(--smartblocks-menu-width) minmax(0, 1fr);
}
.roamjs-smartblocks-picker .roamjs-smartblock-menu {
  width: 100%; height: 350px; overflow-y: auto; background: inherit;
  border-radius: 0; padding: 5px;
}
.roamjs-smartblocks-menu-column { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.roamjs-smartblocks-menu-column .roamjs-smartblock-menu { flex: 1 1 350px; min-height: 0; }
.roamjs-smartblocks-menu-row {
  display: flex; align-items: center; min-height: 33px;
  border-radius: 3px; padding-right: 3px;
}
.roamjs-smartblocks-menu-row.is-active { background: #d6d7df; }
.roamjs-smartblocks-menu-row .roamjs-smartblocks-workflow {
  flex: 1; min-width: 0; min-height: 33px; border-radius: 3px;
  padding: 6px 9px; color: inherit; text-align: left;
}
.roamjs-smartblocks-workflow .bp3-button-text { overflow-wrap: anywhere; white-space: normal; }
.roamjs-smartblocks-menu-row .bp3-button:hover,
.roamjs-smartblocks-menu-row .bp3-button:active { background: rgba(0, 0, 0, 0.04); }
.roamjs-smartblocks-menu-row .roamjs-smartblocks-pin {
  min-width: 26px; min-height: 27px; padding: 4px; color: #5c7080;
}
.roamjs-smartblocks-pin .bp3-icon svg { width: 12px; height: 12px; }
.roamjs-smartblocks-pin[aria-pressed="true"] { color: #106ba3; }
@media (hover: hover) {
  .roamjs-smartblocks-pin[aria-pressed="false"] { opacity: 0; pointer-events: none; }
  .roamjs-smartblocks-menu-row:hover .roamjs-smartblocks-pin[aria-pressed="false"],
  .roamjs-smartblocks-pin[aria-pressed="false"]:focus-visible { opacity: 1; pointer-events: auto; }
}
.roamjs-smartblocks-pin-divider { border-top: 1px solid #e1e4e8; margin: 5px 7px; }
.roamjs-smartblocks-empty { padding: 20px 12px; color: #5c7080; }
.roamjs-smartblocks-footer {
  flex-shrink: 0;
  box-sizing: border-box; min-height: 30px; display: flex; align-items: center;
  justify-content: flex-end; flex-wrap: wrap; gap: 3px; padding: 3px 6px;
  background: #ebeceb; border-top: 1px solid #d3d4d4; color: #182026;
  font-size: 12px; line-height: 14px;
}
.roamjs-smartblocks-footer .bp3-button {
  min-height: 20px; padding: 2px 4px; border-radius: 3px;
  font-size: inherit; line-height: inherit; color: inherit;
}
.roamjs-smartblocks-footer .bp3-button[aria-expanded="true"],
.roamjs-smartblocks-footer .bp3-button[aria-pressed="true"] {
  background: var(--roamjs-selected, rgba(0, 0, 0, 0.11));
}
.roamjs-smartblocks-footer .bp3-button-text { display: flex; align-items: center; gap: 5px; white-space: nowrap; }
.roamjs-smartblocks-keys { display: inline-flex; gap: 2px; }
.roamjs-smartblocks-footer .bp3-button:disabled { opacity: 0.5; }
.roamjs-smartblocks-footer .roamjs-smartblocks-run { font-weight: 700; }
.roamjs-smartblocks-footer-divider { height: 13px; border-left: 1px solid currentColor; opacity: 0.14; }
.roamjs-smartblocks-footer kbd {
  padding: 1px 3px; border-radius: 2px; background: rgba(0, 0, 0, 0.08);
  color: inherit; font-size: 10px; line-height: 12px; font-family: inherit; font-weight: 400;
}
.roamjs-smartblocks-preview {
  min-width: 0; min-height: 0; max-height: 380px; overflow: auto; padding: 14px 16px;
  border-left: 1px solid #dfe3e6; overflow-wrap: anywhere; white-space: pre-wrap;
}
.roamjs-smartblocks-preview-title { color: #5c7080; margin-bottom: 14px; }
.roamjs-smartblocks-preview-tree { margin: 0; padding-left: 18px; list-style: disc; }
.roamjs-smartblocks-preview-tree li { padding: 3px 0; }
.roamjs-smartblocks-preview-tree code { color: #106ba3; background: transparent; font-size: 12px; white-space: pre-wrap; }
.roamjs-smartblocks-preview-note { margin-top: 18px; color: #5c7080; font-size: 11px; }
.bp3-dark .roamjs-smartblocks-picker { background: #293742; color: #f5f8fa; }
.bp3-dark .roamjs-smartblocks-menu-row.is-active { background: #495761; }
.bp3-dark .roamjs-smartblocks-footer { background: #202b33; color: #f5f8fa; }
.bp3-dark .roamjs-smartblocks-footer .bp3-button[aria-expanded="true"],
.bp3-dark .roamjs-smartblocks-footer .bp3-button[aria-pressed="true"] {
  background: var(--roamjs-selected, rgba(255, 255, 255, 0.14));
}
.bp3-dark .roamjs-smartblocks-footer kbd { background: rgba(255, 255, 255, 0.12); }
.bp3-dark .roamjs-smartblocks-pin,
.bp3-dark .roamjs-smartblocks-preview-title,
.bp3-dark .roamjs-smartblocks-preview-note { color: #a7b6c2; }
.bp3-dark .roamjs-smartblocks-preview-tree code { color: #8cc8ee; }
@media (max-width: 640px) {
  .roamjs-smartblocks-picker { height: auto; }
  .roamjs-smartblocks-menu-column {
    height: min(380px, 60vh);
    height: min(380px, 60dvh);
  }
  .roamjs-smartblocks-picker.is-preview-open {
    width: var(--smartblocks-menu-width);
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    height: min(640px, calc(100vh - 24px));
    height: min(640px, calc(100dvh - 24px));
  }
  .roamjs-smartblocks-preview { border-left: 0; border-top: 1px solid #dfe3e6; max-height: 260px; }
}
@media (max-width: 380px) {
  .roamjs-smartblocks-footer-divider { display: none; }
}
@media (pointer: coarse) {
  .roamjs-smartblocks-menu-row .roamjs-smartblocks-pin { min-width: 40px; min-height: 40px; }
}
`;
export default smartblocksMenuStyles;
