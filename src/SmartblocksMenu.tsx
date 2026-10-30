import { Button, Menu, Popover, Position } from "@blueprintjs/core";
import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import type { OnloadArgs } from "roamjs-components/types/native";
import WorkflowPreview, { PreviewNode } from "./components/WorkflowPreview";
import { getCoords } from "./utils/dom";
import {
  getVisibleCustomWorkflows,
  predefinedWorkflows,
  PREDEFINED_REGEX,
  sbBomb,
} from "./utils/core";
import {
  getMenuKeyAction,
  getMenuWorkflows,
  getVisibleScrollTop,
  nextMenuIndex,
  PINNED_WORKFLOWS_SETTING,
  readPinnedWorkflowUids,
} from "./utils/smartblocksMenu";

type Props = {
  textarea: HTMLTextAreaElement;
  triggerStart: number;
  triggerRegex: RegExp;
  isCustomOnly: boolean;
  extensionAPI: OnloadArgs["extensionAPI"];
  onClose: () => void;
};

// Roam's textarea can update before its block has been persisted.
const waitForBlock = ({
  uid,
  text,
  isActive,
}: {
  uid: string;
  text: string;
  isActive: () => boolean;
}): Promise<boolean> =>
  !isActive()
    ? Promise.resolve(false)
    : getTextByBlockUid(uid) === text
      ? Promise.resolve(true)
      : new Promise((resolve) =>
          setTimeout(() => resolve(waitForBlock({ uid, text, isActive })), 10),
        );

const SmartblocksMenu = ({
  onClose,
  textarea,
  triggerStart,
  triggerRegex,
  isCustomOnly,
  extensionAPI,
}: Props): React.ReactElement => {
  const { ["block-uid"]: blockUid, ["window-id"]: windowId } = useMemo(
    () =>
      window.roamAlphaAPI.ui.getFocusedBlock() || {
        "block-uid": "",
        "window-id": "",
      },
    [],
  );
  const readTextarea = useCallback(
    (): HTMLTextAreaElement | null =>
      document.getElementById(textarea.id) as HTMLTextAreaElement | null,
    [textarea.id],
  );
  const readFilter = useCallback(
    (current: HTMLTextAreaElement): string | undefined => {
      const match = triggerRegex.exec(
        current.value.substring(0, current.selectionStart),
      );
      return match?.index === triggerStart ? match[1] || "" : undefined;
    },
    [triggerRegex, triggerStart],
  );
  const [filter, setFilter] = useState(() => readFilter(textarea) || "");
  const [pinnedUids, setPinnedUids] = useState(() =>
    readPinnedWorkflowUids(extensionAPI.settings.get(PINNED_WORKFLOWS_SETTING)),
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const running = useRef(false);
  const mounted = useRef(true);
  const menuRef = useRef<HTMLUListElement | null>(null);
  const menuResizeObserver = useRef<ResizeObserver | null>(null);
  const initialWorkflows = useMemo(
    (): { uid: string; name: string; children?: PreviewNode[] }[] => [
      ...getVisibleCustomWorkflows().sort(({ name: a }, { name: b }) =>
        a.localeCompare(b),
      ),
      ...(isCustomOnly ? [] : predefinedWorkflows),
    ],
    [isCustomOnly],
  );
  const workflows = useMemo(
    () => getMenuWorkflows({ workflows: initialWorkflows, filter, pinnedUids }),
    [filter, initialWorkflows, pinnedUids],
  );
  const index = Math.max(0, Math.min(activeIndex, workflows.length - 1));
  const selected = workflows[index];

  useLayoutEffect(() => {
    mounted.current = true;
    return (): void => {
      mounted.current = false;
    };
  }, []);

  const scrollSelectionIntoView = useCallback((): void => {
    const list = menuRef.current;
    const row = list?.querySelector<HTMLElement>(
      ".roamjs-smartblocks-menu-row.is-active",
    );
    if (!list || !row) return;
    list.scrollTop = getVisibleScrollTop({
      scrollTop: list.scrollTop,
      viewportHeight: list.clientHeight,
      itemTop: row.offsetTop,
      itemHeight: row.offsetHeight,
    });
  }, []);

  useLayoutEffect(scrollSelectionIntoView, [
    index,
    workflows,
    previewOpen,
    scrollSelectionIntoView,
  ]);

  const setMenuNode = useCallback(
    (node: HTMLUListElement | null): void => {
      menuResizeObserver.current?.disconnect();
      menuResizeObserver.current = null;
      menuRef.current = node;
      if (!node) return;
      menuResizeObserver.current = new ResizeObserver(scrollSelectionIntoView);
      menuResizeObserver.current.observe(node);
      scrollSelectionIntoView();
    },
    [scrollSelectionIntoView],
  );

  const onSelect = useCallback(
    (selection: number): void => {
      const workflow = workflows[selection];
      const current = readTextarea();
      if (!workflow || !current || running.current) return;
      if (readFilter(current) === undefined) {
        onClose();
        return;
      }
      const text = current.value;
      const end = current.selectionStart;
      running.current = true;
      waitForBlock({
        uid: blockUid,
        text,
        isActive: () => mounted.current,
      }).then((persisted) => {
        if (!persisted) return;
        const latest = readTextarea();
        if (!latest || latest.value !== text) {
          onClose();
          return;
        }
        onClose();
        setTimeout(() => {
          sbBomb({
            srcUid: workflow.uid,
            target: { uid: blockUid, start: triggerStart, end, windowId },
            mutableCursor: !workflow.name.includes("<%NOCURSOR%>"),
          });
        }, 10);
      });
    },
    [
      workflows,
      readTextarea,
      readFilter,
      blockUid,
      onClose,
      triggerStart,
      windowId,
    ],
  );

  const openSource = useCallback((): void => {
    if (!selected || PREDEFINED_REGEX.test(selected.uid)) return;
    onClose();
    void window.roamAlphaAPI.ui.rightSidebar.addWindow({
      window: { type: "block", "block-uid": selected.uid },
    });
  }, [selected, onClose]);

  const togglePin = (uid: string): void => {
    const next = pinnedUids.includes(uid)
      ? pinnedUids.filter((pinned) => pinned !== uid)
      : [...pinnedUids, uid];
    extensionAPI.settings.set(PINNED_WORKFLOWS_SETTING, next);
    setPinnedUids(next);
    setActiveIndex(
      getMenuWorkflows({
        workflows: initialWorkflows,
        filter,
        pinnedUids: next,
      }).findIndex((workflow) => workflow.uid === uid),
    );
  };

  const keydownListener = useCallback(
    (event: KeyboardEvent): void => {
      const action = getMenuKeyAction(event);
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      if (action === "next" || action === "previous")
        setActiveIndex(
          nextMenuIndex({
            index,
            count: workflows.length,
            direction: action === "next" ? 1 : -1,
          }),
        );
      else if (action === "show-preview") setPreviewOpen(true);
      else if (action === "hide-preview") setPreviewOpen(false);
      else if (action === "source") openSource();
      else if (action === "run") onSelect(index);
      else if (action === "close") onClose();
    },
    [index, workflows.length, openSource, onSelect, onClose],
  );

  useLayoutEffect(() => {
    // Roam can replace the editor during linked-reference updates or resizing.
    const listeningEl = textarea.parentElement || textarea;
    const inputListener = (event: Event): void => {
      if (!(event.target instanceof HTMLTextAreaElement)) return;
      const value = readFilter(event.target);
      if (value === undefined) onClose();
      else {
        setFilter(value);
        setActiveIndex(0);
      }
    };
    listeningEl?.addEventListener("keydown", keydownListener);
    listeningEl?.addEventListener("input", inputListener);
    return () => {
      listeningEl?.removeEventListener("keydown", keydownListener);
      listeningEl?.removeEventListener("input", inputListener);
    };
  }, [keydownListener, readFilter, textarea, onClose]);

  return (
    <Popover
      onClose={onClose}
      isOpen
      canEscapeKeyClose
      minimal
      target={<span />}
      position={Position.BOTTOM_LEFT}
      modifiers={{
        flip: { enabled: true },
        preventOverflow: {
          enabled: true,
          boundariesElement: "viewport",
          padding: 12,
        },
      }}
      autoFocus={false}
      enforceFocus={false}
      content={
        <div
          className={`roamjs-smartblocks-picker${previewOpen ? " is-preview-open" : ""}`}
          aria-label="SmartBlocks menu"
          onMouseDown={(event): void => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event): void => event.stopPropagation()}
        >
          <div className="roamjs-smartblocks-menu-column min-w-0">
            <Menu
              className="roamjs-smartblock-menu relative"
              ulRef={setMenuNode}
              role="listbox"
              aria-label="SmartBlock workflows"
            >
              {workflows.length ? (
                workflows.map((workflow, i) => (
                  <React.Fragment key={workflow.uid}>
                    {!filter &&
                      i > 0 &&
                      workflows[i - 1].pinned &&
                      !workflow.pinned && (
                        <li
                          className="roamjs-smartblocks-pin-divider"
                          role="presentation"
                        />
                      )}
                    <li
                      className={`roamjs-smartblocks-menu-row${i === index ? " is-active" : ""}`}
                      role="presentation"
                      onMouseEnter={(): void => setActiveIndex(i)}
                    >
                      <Button
                        minimal
                        alignText="left"
                        className="roamjs-smartblocks-workflow"
                        icon={
                          PREDEFINED_REGEX.test(workflow.uid) ? "cog" : "cube"
                        }
                        role="option"
                        aria-selected={i === index}
                        data-uid={workflow.uid}
                        data-name={workflow.name}
                        onClick={(): void => onSelect(i)}
                        text={
                          <>
                            {workflow.displayName
                              .split(/<b>(.*?)<\/b>/)
                              .map((part, partIndex) =>
                                partIndex % 2 ? (
                                  <b key={partIndex}>{part}</b>
                                ) : (
                                  <React.Fragment key={partIndex}>
                                    {part}
                                  </React.Fragment>
                                ),
                              )}
                          </>
                        }
                      />
                      <Button
                        minimal
                        small
                        icon="pin"
                        className="roamjs-smartblocks-pin"
                        aria-label={`${workflow.pinned ? "Unpin" : "Pin"} ${workflow.name}`}
                        aria-pressed={workflow.pinned}
                        title={
                          workflow.pinned ? "Unpin workflow" : "Pin workflow"
                        }
                        onClick={(): void => togglePin(workflow.uid)}
                      />
                    </li>
                  </React.Fragment>
                ))
              ) : (
                <li role="presentation" className="roamjs-smartblocks-empty">
                  No Workflows Found
                </li>
              )}
            </Menu>
            <footer className="roamjs-smartblocks-footer">
              <span className="roamjs-smartblocks-footer-label">
                SmartBlocks
              </span>
              <div className="roamjs-smartblocks-footer-actions">
                <Button
                  minimal
                  aria-expanded={previewOpen}
                  onClick={(): void => setPreviewOpen(!previewOpen)}
                  text={
                    <>
                      {previewOpen ? "Hide preview" : "Preview"}
                      <kbd>{previewOpen ? "←" : "→"}</kbd>
                    </>
                  }
                />
                <span
                  className="roamjs-smartblocks-footer-divider"
                  aria-hidden="true"
                />
                <Button
                  minimal
                  disabled={!selected || PREDEFINED_REGEX.test(selected.uid)}
                  title={
                    selected && PREDEFINED_REGEX.test(selected.uid)
                      ? "Built-in workflows have no source block"
                      : "Open workflow source in the right sidebar"
                  }
                  onClick={openSource}
                  text={
                    <>
                      Source<kbd>⇧ ↵</kbd>
                    </>
                  }
                />
                <span
                  className="roamjs-smartblocks-footer-divider"
                  aria-hidden="true"
                />
                <Button
                  minimal
                  className="roamjs-smartblocks-run"
                  disabled={!selected}
                  onClick={(): void => onSelect(index)}
                  text={
                    <>
                      Run<kbd>↵</kbd>
                    </>
                  }
                />
              </div>
            </footer>
          </div>
          {previewOpen &&
            (selected ? (
              <WorkflowPreview
                key={selected.uid}
                uid={selected.uid}
                name={selected.name}
                children={selected.children}
              />
            ) : (
              <aside
                className="roamjs-smartblocks-preview"
                aria-label="Workflow preview"
              >
                No workflow selected.
              </aside>
            ))}
        </div>
      }
    />
  );
};

export const render = (props: Props): void => {
  if (!props.textarea.parentElement || !props.textarea.isConnected) {
    props.onClose();
    return;
  }
  const parent = document.createElement("span");
  const coords = getCoords(props.textarea);
  parent.style.position = "absolute";
  parent.style.left = `${coords.left}px`;
  parent.style.top = `${coords.top}px`;
  props.textarea.parentElement?.insertBefore(parent, props.textarea);
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    observer.disconnect();
    props.onClose();
    ReactDOM.unmountComponentAtNode(parent);
    parent.remove();
  };
  const observer = new MutationObserver(() => {
    if (!parent.isConnected || !document.getElementById(props.textarea.id))
      close();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  ReactDOM.render(<SmartblocksMenu {...props} onClose={close} />, parent);
};
export default SmartblocksMenu;
