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
import { getVisibleCustomWorkflows, sbBomb } from "./core";
import fuzzy from "fuzzy";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";

type Props = {
  initialLocations: string[];
};

const BulkTrigger = ({
  onClose,
  initialLocations,
}: { onClose: () => void } & Props) => {
  const allWorkflows = useMemo(() => getVisibleCustomWorkflows(), []);
  const allWorkflowLabels = useMemo(
    () => allWorkflows.map((w) => w.name),
    [allWorkflows]
  );
  const workflowByName = useMemo(
    () => Object.fromEntries(allWorkflows.map((w) => [w.name, w])),
    [allWorkflows]
  );
  const [workflows, setWorkflows] = useState<
    ReturnType<typeof getVisibleCustomWorkflows>
  >([]);
  const [locations, setLocations] = useState<string[]>(initialLocations);
  const [activeWorkflow, setActiveWorkflow] = useState("");
  const [activeLocation, setActiveLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
            <AutocompleteInput
              value={activeWorkflow}
              setValue={setActiveWorkflow}
              showButton
              onConfirm={() => {
                setWorkflows([...workflows, workflowByName[activeWorkflow]]);
              }}
              options={allWorkflowLabels}
            />
            {workflows.map((wf) => (
              <p key={wf.uid} className={"flex items-center justify-between"}>
                {wf}
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
                return workflows.map(({ uid: srcUid }) => async () => {
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

export const render = createOverlayRender<Props>(
  "smartblocks-bulk-trigger",
  BulkTrigger
);

export default BulkTrigger;
