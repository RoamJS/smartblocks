import {
  Button,
  Classes,
  Dialog,
  Intent,
  Spinner,
  SpinnerSize,
} from "@blueprintjs/core";
import axios from "axios";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";

type WorkflowReview = { version?: string; workflow?: string };

const WorkflowReviewView = ({
  version = "None",
  workflow = '"None"',
  label,
}: WorkflowReview & { label: string }) => {
  return (
    <div
      style={{
        width: "50%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <h3 style={{ padding: 4, minHeight: 40 }}>
        {label} ({version})
      </h3>
      <div
        style={{
          padding: 4,
          border: "1px solid gray",
          fontFamily: "monospace",
          whiteSpace: "pre-wrap",
          overflowY: "scroll",
        }}
      >
        {JSON.stringify(JSON.parse(workflow), null, 4)}
      </div>
    </div>
  );
};

const ReviewPanel = ({ parentUid }: { parentUid: string }) => {
  const token = useMemo(
    () =>
      getSettingValueFromTree({
        tree: getBasicTreeByParentUid(parentUid),
        key: "token",
      }),
    [parentUid]
  );
  const [workflows, setWorkflows] = useState<{ name: string; uuid: string }[]>(
    []
  );
  const [reviewable, setReviewable] = useState(false);
  const [inReview, setInReview] = useState<{ name: string; uuid: string }>();
  const [loading, setLoading] = useState(true);
  const onClose = useCallback(() => setInReview(undefined), [setInReview]);
  const [error, setError] = useState("");
  const [reviewData, setReviewData] = useState<{
    oldWorkflow: WorkflowReview;
    newWorkflow: WorkflowReview;
  }>();
  useEffect(() => {
    axios
      .get(`${process.env.API_URL}/smartblocks-review?graph=${window.roamAlphaAPI.graph.name}`, {
        headers: { Authorization: token },
      })
      .then((r) => {
        setReviewable(r.data.reviewable);
        setWorkflows(r.data.workflows);
      })
      .catch((e) =>
        setError(e.response?.data?.message || e.response?.data || e.message)
      )
      .finally(() => setLoading(false));
  }, [setLoading, setReviewable, setWorkflows, token]);
  useEffect(() => {
    if (inReview) {
      axios
        .get(
          `${process.env.API_URL}/smartblocks-review?graph=${window.roamAlphaAPI.graph.name}&uuid=${
            inReview.uuid
          }`,
          {
            headers: { Authorization: token },
          }
        )
        .then((r) => {
          setReviewData(r.data);
        })
        .catch((e) =>
          setError(e.response?.data?.message || e.response?.data || e.message)
        )
        .finally(() => setLoading(false));
    }
  }, [inReview, setLoading, setError, setReviewData]);
  return (
    <>
      {!loading && !workflows.length ? (
        <p>No workflows under review!</p>
      ) : (
        <ul className={loading ? Classes.SKELETON : ""}>
          {workflows.map((w) => (
            <li key={w.uuid}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ display: "inline-block" }}>{w.name}</span>
                {reviewable && (
                  <Button
                    minimal
                    icon={"flow-review"}
                    onClick={() => {
                      setLoading(true);
                      setInReview(w);
                    }}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        portalClassName={"roamjs-smartblock-workflow-review"}
        isOpen={!!inReview}
        onClose={onClose}
        title={`Review ${inReview?.name}`}
        canEscapeKeyClose
        canOutsideClickClose
      >
        <div className={Classes.DIALOG_BODY}>
          {loading ? (
            <Spinner size={SpinnerSize.LARGE} />
          ) : (
            <div style={{ display: "flex", height: "100%" }}>
              <WorkflowReviewView {...reviewData?.oldWorkflow} label={"Old"} />
              <WorkflowReviewView {...reviewData?.newWorkflow} label={"New"} />
            </div>
          )}
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <span style={{ color: "darkred" }}>{error}</span>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            {loading && <Spinner size={SpinnerSize.SMALL} />}
            <Button text={"Cancel"} onClick={onClose} />
            <Button
              text={"Approve"}
              intent={Intent.PRIMARY}
              onClick={() => {
                setLoading(true);
                axios
                  .put(
                    `${process.env.API_URL}/smartblocks-review`,
                    {
                      uuid: inReview.uuid,
                      graph: window.roamAlphaAPI.graph.name,
                      version: reviewData.newWorkflow?.version,
                    },
                    { headers: { Authorization: token } }
                  )
                  .then(() => {
                    setWorkflows(
                      workflows.filter((w) => inReview.uuid !== w.uuid)
                    );
                    setInReview(undefined);
                    setReviewData(undefined);
                  })
                  .catch((e) =>
                    setError(
                      e.response?.data?.message || e.response?.data || e.message
                    )
                  )
                  .finally(() => setLoading(false));
              }}
            />
          </div>
        </div>
      </Dialog>
    </>
  );
};

export default ReviewPanel;
