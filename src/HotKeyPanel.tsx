import { Button, InputGroup, Intent, Label } from "@blueprintjs/core";
import React, { useMemo, useState } from "react";
import {
  createBlock,
  getBasicTreeByParentUid,
  getFirstChildUidByBlockUid,
  updateBlock,
} from "roam-client";
import { MenuItemSelect } from "roamjs-components";
import { getCleanCustomWorkflows } from "./smartblocks";

export type SmartblockHotKeys = {
  uidToMapping: Record<string, string>;
  mappingToBlock: Record<string, string>;
};

const HotKeyPanel =
  (smartblockHotKeys: SmartblockHotKeys) =>
  ({ parentUid, uid: inputUid }: { uid?: string; parentUid: string }) => {
    const workflows = useMemo(
      () =>
        getCleanCustomWorkflows().sort(({ name: a }, { name: b }) =>
          a.localeCompare(b)
        ),
      []
    );
    const workflowNamesByUid = useMemo(
      () => Object.fromEntries(workflows.map((wf) => [wf.uid, wf.name])),
      []
    );
    const uid = useMemo(
      () =>
        inputUid ||
        createBlock({ node: { text: "hot keys" }, parentUid, order: 4 }),
      [inputUid]
    );
    const [keys, setKeys] = useState(() =>
      inputUid
        ? getBasicTreeByParentUid(uid).map(
            ({ text, uid, children: [{ text: smartblock }] = [] }, i, all) => ({
              text,
              uid,
              smartblock,
              error: all.slice(0, i).some(({ text: other }) => other === text),
            })
          )
        : []
    );
    return (
      <>
        {keys.map((key) => (
          <div key={key.uid} style={{ display: "flex", alignItems: "center" }}>
            <Label>
              Hot Key
              <InputGroup
                placeholder={"Type the keys themselves"}
                value={key.text}
                onChange={() => true}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const parts = key.text ? key.text.split("+") : [];
                  const formatValue = (
                    e.key === "Backspace"
                      ? parts.slice(0, -1)
                      : ["Shift", "Control", "Alt", "Meta"].includes(e.key)
                      ? Array.from(
                          new Set(parts.concat(e.key.toLowerCase()))
                        ).sort((a, b) => b.length - a.length)
                      : parts.concat(e.key.toLowerCase())
                  ).join("+");
                  if (formatValue === key.text) return;
                  const error =
                    !formatValue ||
                    !!smartblockHotKeys.mappingToBlock[formatValue];
                  setKeys(
                    keys.map((k) =>
                      k.uid !== key.uid
                        ? k
                        : { ...key, text: formatValue, error }
                    )
                  );
                  if (!error) {
                    const oldMapping = smartblockHotKeys.uidToMapping[key.uid];
                    smartblockHotKeys.mappingToBlock[formatValue] =
                      smartblockHotKeys.mappingToBlock[oldMapping];
                    smartblockHotKeys.uidToMapping[key.uid] = formatValue;
                    delete smartblockHotKeys.mappingToBlock[oldMapping];
                    updateBlock({ text: formatValue, uid: key.uid });
                  }
                }}
                intent={key.error ? Intent.DANGER : Intent.NONE}
              />
            </Label>
            <Label className={"roamjs-smartblock-hotkey-block"}>
              SmartBlock
              <MenuItemSelect
                activeItem={key.smartblock}
                items={workflows.map((w) => w.uid)}
                onItemSelect={(e) => {
                  setKeys(
                    keys.map((k) =>
                      k.uid !== key.uid ? k : { ...key, smartblock: e }
                    )
                  );
                  smartblockHotKeys.mappingToBlock[
                    smartblockHotKeys.uidToMapping[key.uid]
                  ] = e;
                  updateBlock({
                    text: e,
                    uid: getFirstChildUidByBlockUid(key.uid),
                  });
                }}
                transformItem={(e) => workflowNamesByUid[e]}
              />
            </Label>
            <Button
              icon={"trash"}
              style={{ width: 32, height: 32 }}
              minimal
              onClick={() => {
                setKeys(keys.filter((k) => k.uid !== key.uid));
                delete smartblockHotKeys.mappingToBlock[
                  smartblockHotKeys.uidToMapping[key.uid]
                ];
                delete smartblockHotKeys.uidToMapping[key.uid];
                deleteBlock(key.uid);
              }}
            />
          </div>
        ))}
        <Button
          text={"Add Hot Key"}
          intent={Intent.PRIMARY}
          rightIcon={"plus"}
          minimal
          style={{ marginTop: 8 }}
          onClick={() => {
            const randomWorkflow =
              workflows[Math.floor(Math.random() * workflows.length)];
            const valueUid = createBlock({
              parentUid: uid,
              order: keys.length,
              node: {
                text: "control+o",
                children: [{ text: randomWorkflow.uid }],
              },
            });
            setTimeout(() => {
              setKeys([
                ...keys,
                {
                  text: "control+o",
                  smartblock: randomWorkflow.uid,
                  uid: valueUid,
                  error: keys.some(({ text }) => text === "control+o"),
                },
              ]);
            }, 1);
          }}
        />
      </>
    );
  };

export default HotKeyPanel;
function deleteBlock(uid: string) {
  throw new Error("Function not implemented.");
}
