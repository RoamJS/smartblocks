import {
  Button,
  Classes,
  Dialog,
  InputGroup,
  Intent,
  Menu,
  MenuItem,
  Popover,
  PopoverPosition,
  Spinner,
  SpinnerSize,
} from "@blueprintjs/core";
import React, { useCallback, useMemo, useRef, useState } from "react";
import createBlock from "roamjs-components/writes/createBlock";
import getChildrenLengthByPageUid from "roamjs-components/queries/getChildrenLengthByPageUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import createOverlayRender from "roamjs-components/util/createOverlayRender";
import PageInput from "roamjs-components/components/PageInput";
import useArrowKeyDown from "roamjs-components/hooks/useArrowKeyDown";
import { getVisibleCustomWorkflows, sbBomb } from "./smartblocks";
import fuzzy from "fuzzy";

type Props = {
  initialLocations: string[];
};

const BulkTrigger = ({
  onClose,
  initialLocations,
}: { onClose: () => void } & Props) => {
  const allWorkflows = useMemo(() => getVisibleCustomWorkflows(), []);
  const workflowNameByUid = useMemo(
    () => Object.fromEntries(allWorkflows.map(({ uid, name }) => [uid, name])),
    [allWorkflows]
  );
  const [workflows, setWorkflows] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>(initialLocations);
  const [activeWorkflow, setActiveWorkflow] = useState("");
  const [activeLocation, setActiveLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const workflowOpen = useCallback(() => setIsOpen(true), [setIsOpen]);
  const workflowClose = useCallback(() => setIsOpen(false), [setIsOpen]);
  const inputRef = useRef<HTMLInputElement>(null);
  const items = useMemo(
    () =>
      activeWorkflow && isOpen
        ? fuzzy
            .filter(
              workflowNameByUid[activeWorkflow] || activeWorkflow,
              allWorkflows,
              { extract: (e) => e.name }
            )
            .map((e) => e.original)
            .filter(({ uid }) => !workflows.includes(uid))
            .slice(0, 9)
        : [],
    [activeWorkflow, allWorkflows, workflowNameByUid, workflows, isOpen]
  );
  const { activeIndex, onKeyDown } = useArrowKeyDown({
    onEnter: (a) => {
      setWorkflows([...workflows, a.uid]);
      setActiveWorkflow("");
      workflowClose();
    },
    results: items,
  });
  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      title={"Trigger Multiple Smart blocks"}
      canEscapeKeyClose
      canOutsideClickClose
    >
      <div className={Classes.DIALOG_BODY}>
        <div style={{ display: "flex" }}>
          <div style={{ width: "50%", paddingRight: 4 }}>
            <h6>Workflows</h6>
            <div style={{ display: "flex" }}>
              <Popover
                captureDismiss={true}
                isOpen={isOpen}
                onOpened={workflowOpen}
                minimal={true}
                position={PopoverPosition.BOTTOM_LEFT}
                content={
                  <Menu style={{ maxWidth: 400 }}>
                    {items.map((t, i) => (
                      <MenuItem
                        text={t.name}
                        active={activeIndex === i}
                        key={i}
                        multiline
                        onClick={() => {
                          setActiveWorkflow(t.uid);
                          workflowClose();
                          inputRef.current?.focus();
                        }}
                      />
                    ))}
                  </Menu>
                }
                target={
                  <InputGroup
                    value={workflowNameByUid[activeWorkflow] || activeWorkflow}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setActiveWorkflow(e.target.value);
                      setIsOpen(!!e.target.value);
                    }}
                    placeholder={"Search for a workflow"}
                    onKeyDown={onKeyDown}
                    onBlur={(e) => {
                      if (e.relatedTarget) {
                        workflowClose();
                      }
                    }}
                    inputRef={inputRef}
                    rightElement={
                      <Button
                        minimal
                        disabled={
                          !activeWorkflow || !workflowNameByUid[activeWorkflow]
                        }
                        icon={"add"}
                        onClick={() => {
                          setWorkflows([...workflows, activeWorkflow]);
                          setActiveWorkflow("");
                        }}
                      />
                    }
                  />
                }
              />
            </div>
            {workflows.map((wf) => (
              <p
                key={wf}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                {allWorkflows.find(({ uid }) => uid === wf)?.name}
                <Button
                  minimal
                  icon={"trash"}
                  onClick={() => {
                    setWorkflows(workflows.filter((w) => w !== wf));
                  }}
                />
              </p>
            ))}
          </div>
          <div style={{ width: "50%", paddingLeft: 4 }}>
            <h6>Locations</h6>
            <div style={{ display: "flex" }}>
              <PageInput
                value={activeLocation}
                setValue={setActiveLocation}
                onConfirm={() => {
                  setLocations([...locations, activeLocation]);
                  setActiveLocation("");
                }}
                showButton
              />
            </div>
            {locations.map((l) => (
              <p
                key={l}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                {l}
                <Button
                  minimal
                  icon={"trash"}
                  onClick={() => {
                    setLocations(locations.filter((loc) => loc !== l));
                  }}
                />
              </p>
            ))}
          </div>
        </div>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <span style={{ color: "darkred" }}>{error}</span>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          {loading && <Spinner size={SpinnerSize.SMALL} />}
          <Button
            text={"Run"}
            intent={Intent.PRIMARY}
            disabled={!workflows.length || !locations.length || loading}
            onClick={() => {
              setLoading(true);
              setError("");
              const promises = locations.flatMap((loc) => {
                const pageUid = getPageUidByPageTitle(loc);
                return workflows.map((srcUid) => async () => {
                  const order = getChildrenLengthByPageUid(pageUid);
                  return createBlock({
                    node: { text: "" },
                    parentUid: pageUid,
                    order,
                  }).then((targetUid) =>
                    sbBomb({
                      srcUid,
                      target: {
                        uid: targetUid,
                        start: 0,
                        end: 0,
                      },
                    })
                  );
                });
              });
              promises
                .reduce((prev, cur) => prev.then(cur), Promise.resolve())
                .then(onClose)
                .catch((e) => {
                  setLoading(false);
                  setError(e.message);
                });
            }}
          />
        </div>
      </div>
    </Dialog>
  );
};

export const render = createOverlayRender(
  "smartblocks-bulk-trigger",
  BulkTrigger
);

export default BulkTrigger;
