import React, { useMemo } from "react";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";

export type PreviewNode = { text: string; children?: PreviewNode[] };
const PreviewTree = ({
  nodes,
}: {
  nodes: PreviewNode[];
}): React.ReactElement => (
  <ul className="roamjs-smartblocks-preview-tree">
    {nodes.map((node, index) => (
      <li key={index}>
        <span>
          {node.text
            .split(/(<%.*?%>)/g)
            .map((part, partIndex) =>
              part.startsWith("<%") ? (
                <code key={partIndex}>{part}</code>
              ) : (
                <React.Fragment key={partIndex}>{part}</React.Fragment>
              ),
            )}
        </span>
        {!!node.children?.length && <PreviewTree nodes={node.children} />}
      </li>
    ))}
  </ul>
);

const WorkflowPreview = ({
  uid,
  name,
  children,
}: {
  uid: string;
  name: string;
  children?: PreviewNode[];
}): React.ReactElement => {
  const result = useMemo((): { nodes: PreviewNode[]; error?: string } => {
    try {
      return { nodes: children ?? getFullTreeByParentUid(uid).children ?? [] };
    } catch {
      return { nodes: [], error: "Unable to read this workflow's source." };
    }
  }, [uid, children]);
  return (
    <aside className="roamjs-smartblocks-preview" aria-label="Workflow preview">
      <div className="roamjs-smartblocks-preview-title">{name}</div>
      {result.error ? (
        <div role="alert">{result.error}</div>
      ) : result.nodes.length ? (
        <PreviewTree nodes={result.nodes} />
      ) : (
        <div>This workflow has no child blocks.</div>
      )}
      <div className="roamjs-smartblocks-preview-note">
        Template preview · commands are not executed
      </div>
    </aside>
  );
};
export default WorkflowPreview;
