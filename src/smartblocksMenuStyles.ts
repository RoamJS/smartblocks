const smartblocksMenuStyles = `
.roamjs-smartblocks-picker {
  display: grid; grid-template-columns: minmax(0, 1fr);
  width: min(440px, calc(100vw - 24px)); background: white; color: #394b59;
  max-height: calc(100vh - 24px);
  max-height: calc(100dvh - 24px);
  border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
  overflow: hidden; font-size: 14px;
}
.roamjs-smartblocks-picker.is-preview-open {
  width: min(760px, calc(100vw - 24px));
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr);
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
.roamjs-smartblocks-pin[aria-pressed="false"] { opacity: 0; }
.roamjs-smartblocks-menu-row.is-active .roamjs-smartblocks-pin,
.roamjs-smartblocks-menu-row:hover .roamjs-smartblocks-pin,
.roamjs-smartblocks-menu-row:focus-within .roamjs-smartblocks-pin { opacity: 1; }
.roamjs-smartblocks-pin-divider { border-top: 1px solid #e1e4e8; margin: 5px 7px; }
.roamjs-smartblocks-empty { padding: 20px 12px; color: #5c7080; }
.roamjs-smartblocks-footer {
  flex-shrink: 0;
  box-sizing: border-box; min-height: 30px; display: flex; align-items: center;
  flex-wrap: wrap; gap: 8px; padding: 3px 8px;
  background: #ebeceb; border-top: 1px solid #d3d4d4; color: #394b59;
  font-size: 12px; line-height: 12px;
}
.roamjs-smartblocks-footer-label { margin-right: auto; }
.roamjs-smartblocks-footer-actions {
  display: flex; align-items: center; justify-content: flex-end;
  flex-wrap: wrap; gap: 7px; margin-left: auto;
}
.roamjs-smartblocks-footer .bp3-button {
  min-height: 20px; padding: 2px 0; font-size: 12px; line-height: 12px; color: inherit;
}
.roamjs-smartblocks-footer .bp3-button-text { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.roamjs-smartblocks-footer .bp3-button:disabled { opacity: 0.5; }
.roamjs-smartblocks-footer .roamjs-smartblocks-run { font-weight: 700; }
.roamjs-smartblocks-footer-divider { height: 13px; border-left: 1px solid #d3d4d4; }
.roamjs-smartblocks-footer kbd {
  padding: 1px 4px; border-radius: 2px; background: rgba(0, 0, 0, 0.08);
  color: #5c7080; font-size: 10px; line-height: 12px; font-family: inherit;
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
.bp3-dark .roamjs-smartblocks-pin,
.bp3-dark .roamjs-smartblocks-preview-title,
.bp3-dark .roamjs-smartblocks-preview-note { color: #a7b6c2; }
.bp3-dark .roamjs-smartblocks-preview-tree code { color: #8cc8ee; }
@media (max-width: 560px) {
  .roamjs-smartblocks-picker.is-preview-open {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) minmax(0, 0.75fr);
    height: min(640px, calc(100vh - 24px));
    height: min(640px, calc(100dvh - 24px));
  }
  .roamjs-smartblocks-preview { border-left: 0; border-top: 1px solid #dfe3e6; max-height: 260px; }
  .roamjs-smartblocks-footer-label { display: none; }
}
@media (pointer: coarse) {
  .roamjs-smartblocks-menu-row .roamjs-smartblocks-pin { min-width: 40px; min-height: 40px; opacity: 1; }
}
`;
export default smartblocksMenuStyles;
