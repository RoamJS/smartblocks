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
import { createTriggerMenuEventBinding, getCoords } from "./utils/dom";
import getTriggerSelection, {
  isCurrentTriggerSelection,
} from "./utils/getTriggerSelection";
import type { TriggerSelection } from "./utils/getTriggerSelection";
import handleTriggerMenuKeydown from "./utils/handleTriggerMenuKeydown";
import {
  getVisibleCustomWorkflows,
  predefinedWorkflows,
  PREDEFINED_REGEX,
  sbBomb,
} from "./utils/core";
import {
  getMenuWorkflows,
  getVisibleScrollTop,
  nextMenuIndex,
  PINNED_WORKFLOWS_SETTING,
  readPinnedWorkflowUids,
} from "./utils/smartblocksMenu";

type Props = {
  textarea: HTMLTextAreaElement;
  trigger: string;
  initialSelection: TriggerSelection;
  isCustomOnly: boolean;
  extensionAPI: OnloadArgs["extensionAPI"];
  onClose: () => void;
};

const isRunControl = (target: EventTarget): boolean =>
  target instanceof Element &&
  Boolean(
    target.closest(".roamjs-smartblocks-workflow, .roamjs-smartblocks-run"),
  );

// Roam's textarea can update before its block has been persisted.
const waitForBlock = async ({
  uid,
  selection,
  readTextarea,
  closeEditor,
  signal,
}: {
  uid: string;
  selection: TriggerSelection;
  readTextarea: () => HTMLTextAreaElement | null;
  closeEditor: boolean;
  signal: AbortSignal;
}): Promise<boolean> => {
  const deadline = Date.now() + 3000;
  while (!signal.aborted && Date.now() < deadline) {
    const editor = readTextarea();
    if (
      !closeEditor &&
      (!editor || !isCurrentTriggerSelection(selection, editor))
    )
      return false;
    if ((!closeEditor || !editor) && getTextByBlockUid(uid) === selection.text)
      return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return false;
};

const SmartblocksMenu = ({
  onClose,
  anchor,
  textarea,
  trigger,
  initialSelection,
  isCustomOnly,
  extensionAPI,
}: Props & { anchor: HTMLElement }): React.ReactElement => {
  const { ["block-uid"]: blockUid, ["window-id"]: windowId } = useMemo(
    () =>
      window.roamAlphaAPI.ui.getFocusedBlock() || {
        "block-uid": "",
        "window-id": "",
      },
    [],
  );
  const readTextarea = useCallback((): HTMLTextAreaElement | null => {
    const editor = textarea.ownerDocument.getElementById(textarea.id);
    return editor?.tagName === "TEXTAREA"
      ? (editor as HTMLTextAreaElement)
      : null;
  }, [textarea]);
  const [selection, setSelection] = useState(initialSelection);
  const { filter } = selection;
  const [pinnedUids, setPinnedUids] = useState(() =>
    readPinnedWorkflowUids(extensionAPI.settings.get(PINNED_WORKFLOWS_SETTING)),
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const pendingSelection = useRef<{
    controller: AbortController;
    closeEditor: boolean;
  }>();
  const menuRef = useRef<HTMLUListElement | null>(null);
  const menuResizeObserver = useRef<ResizeObserver | null>(null);
  const initialWorkflows = useMemo(
    (): { uid: string; name: string; children?: PreviewNode[] }[] => [
      ...getVisibleCustomWorkflows()
        .filter(({ name }) => name.trim().length > 0)
        .sort(({ name: a }, { name: b }) => a.localeCompare(b)),
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
    const observer = new MutationObserver(() => {
      // A pointer run deliberately blurs the editor before Roam saves it.
      if (pendingSelection.current?.closeEditor) return;
      if (!anchor.isConnected || !readTextarea()) onClose();
    });
    observer.observe(textarea.ownerDocument.body, {
      childList: true,
      subtree: true,
    });
    return (): void => {
      observer.disconnect();
      pendingSelection.current?.controller.abort();
    };
  }, [anchor, onClose, readTextarea, textarea]);

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
    (workflowIndex: number, closeEditor: boolean): void => {
      const workflow = workflows[workflowIndex];
      const current = readTextarea();
      if (!workflow || pendingSelection.current) return;
      if (!current || !isCurrentTriggerSelection(selection, current)) {
        onClose();
        return;
      }
      const controller = new AbortController();
      pendingSelection.current = { controller, closeEditor };
      if (closeEditor) current.blur();
      waitForBlock({
        uid: blockUid,
        selection,
        readTextarea,
        closeEditor,
        signal: controller.signal,
      }).then((persisted) => {
        if (controller.signal.aborted) return;
        pendingSelection.current = undefined;
        onClose();
        if (!persisted) return;
        setTimeout(() => {
          const liveEditor = readTextarea();
          if (liveEditor && liveEditor.value !== selection.text) return;
          sbBomb({
            srcUid: workflow.uid,
            target: {
              uid: blockUid,
              originalText: selection.text,
              start: selection.start,
              end: selection.end,
              windowId,
            },
            mutableCursor: !workflow.name.includes("<%NOCURSOR%>"),
          });
        }, 10);
      });
    },
    [workflows, readTextarea, blockUid, onClose, selection, windowId],
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
      const editor = readTextarea();
      if (!editor || event.target !== editor) return;
      handleTriggerMenuKeydown({
        event,
        editor,
        selection,
        onClose,
        onAction: (action) => {
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
          else if (action === "run") onSelect(index, false);
          else if (action === "close") onClose();
        },
      });
    },
    [
      index,
      workflows.length,
      openSource,
      onSelect,
      onClose,
      readTextarea,
      selection,
    ],
  );

  const bindEvents = useMemo(
    () => createTriggerMenuEventBinding(textarea),
    [textarea],
  );
  useLayoutEffect(() => {
    const inputListener = (event: Event): void => {
      const editor = readTextarea();
      if (!editor || event.target !== editor) return;
      pendingSelection.current?.controller.abort();
      pendingSelection.current = undefined;
      const nextSelection = getTriggerSelection({
        text: editor.value,
        selectionStart: editor.selectionStart,
        trigger,
        previousSelection: selection,
      });
      if (!nextSelection || !anchor.isConnected) return onClose();
      setSelection(nextSelection);
      setActiveIndex(0);
    };
    return bindEvents(keydownListener, inputListener);
  }, [
    anchor,
    bindEvents,
    keydownListener,
    onClose,
    readTextarea,
    selection,
    trigger,
  ]);

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
            if (!isRunControl(event.target)) event.stopPropagation();
          }}
          onClick={(event): void => {
            // Roam needs the run click to leave edit mode and commit the block.
            if (!isRunControl(event.target)) event.stopPropagation();
          }}
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
                        onClick={(): void => onSelect(i, true)}
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
                  onClick={(): void => onSelect(index, true)}
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
  const parent = props.textarea.ownerDocument.createElement("span");
  const coords = getCoords(props.textarea);
  parent.style.position = "absolute";
  parent.style.left = `${coords.left}px`;
  parent.style.top = `${coords.top}px`;
  props.textarea.parentElement?.insertBefore(parent, props.textarea);
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    props.onClose();
    ReactDOM.unmountComponentAtNode(parent);
    parent.remove();
  };
  ReactDOM.render(
    <SmartblocksMenu {...props} anchor={parent} onClose={close} />,
    parent,
  );
};
export default SmartblocksMenu;
