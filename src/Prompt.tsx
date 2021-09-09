import { Alert, Classes, H3, InputGroup, Label } from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { extractTag } from "roam-client";
import {
  BlockInput,
  createOverlayRender,
  MenuItemSelect,
  PageInput,
} from "roamjs-components";

type Props = {
  display?: string;
  initialValue?: string;
  options?: string[];
  resolve: (value: string) => void;
};

const Prompt = ({
  onClose,
  options = [],
  display = `Enter ${options.length ? "Dropdown" : "Input"} Value`,
  initialValue = "",
  resolve,
}: { onClose: () => void } & Props) => {
  const formattedDisplay = useMemo(
    () =>
      display
        .replace("{page}", "")
        .replace("{block}", "")
        .replace("{ref}", "")
        .trim(),
    [display]
  );
  const isPageInput = useMemo(() => /{page}/.test(display), [display]);
  const isBlockInput = useMemo(() => /{(block|ref)}/.test(display), [display]);
  const formattedOptions = useMemo(
    () => (isPageInput ? options.map(extractTag) : options),
    [options, isPageInput]
  );
  const formattedInitialValue = useMemo(
    () => (isPageInput ? extractTag(initialValue) : initialValue),
    [initialValue, isPageInput]
  );
  const [value, setValue] = useState(formattedInitialValue);
  const [loaded, setLoaded] = useState(false);
  const resolveAndClose = useCallback(
    (s: string) => {
      resolve(isPageInput && s ? `[[${s}]]` : s);
      onClose();
    },
    [resolve, onClose]
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const [uid, setUid] = useState("");
  useEffect(() => {
    if (!loaded) {
      setLoaded(true);
    }
  }, [loaded, setLoaded]);
  useEffect(() => {
    if (contentRef.current && loaded) {
      contentRef.current.closest<HTMLDivElement>(".bp3-overlay").style.zIndex =
        "1000";
    }
  }, [contentRef, loaded]);
  return (
    <Alert
      isOpen={true}
      canOutsideClickCancel
      canEscapeKeyCancel
      onCancel={() => resolveAndClose("")}
      onConfirm={() =>
        resolveAndClose(/{ref}/.test(display) ? `((${uid}))` : value)
      }
      cancelButtonText={"cancel"}
    >
      <H3>SmartBlocks Input</H3>
      <div className={Classes.ALERT_BODY} ref={contentRef}>
        <Label>
          {formattedDisplay}
          {formattedOptions.length ? (
            <MenuItemSelect
              activeItem={value}
              onItemSelect={(v) => setValue(v)}
              items={[formattedInitialValue, ...formattedOptions]}
              popoverProps={{ portalClassName: "roamjs-prompt-dropdown" }}
              ButtonProps={{ autoFocus: true }}
            />
          ) : isPageInput ? (
            <PageInput
              value={value}
              setValue={setValue}
              onConfirm={() => resolveAndClose(value)}
            />
          ) : isBlockInput ? (
            <BlockInput
              value={value}
              setValue={(q, s) => {
                setValue(q);
                setUid(s);
              }}
              onConfirm={() => {
                resolveAndClose(/{ref}/.test(display) ? `((${uid}))` : value);
              }}
            />
          ) : (
            <InputGroup
              placeholder={"Enter value..."}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && resolveAndClose(value)}
            />
          )}
        </Label>
      </div>
    </Alert>
  );
};

export const renderPrompt = (props: Omit<Props, "resolve">) =>
  new Promise<string>((resolve) =>
    createOverlayRender<Props>(
      "smartblocks-prompt",
      Prompt
    )({ ...props, resolve })
  );

export default Prompt;
