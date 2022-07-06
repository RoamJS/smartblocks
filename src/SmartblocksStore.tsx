import {
  Button,
  Classes,
  Drawer,
  H6,
  Icon,
  InputGroup,
  Intent,
  Label,
  NumericInput,
  Position,
  Spinner,
  SpinnerSize,
  Tab,
  Tabs,
  Tooltip,
} from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import createOverlayRender from "roamjs-components/util/createOverlayRender";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getSubTree from "roamjs-components/util/getSubTree";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getCurrentUserEmail from "roamjs-components/queries/getCurrentUserEmail";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import getDisplayNameByUid from "roamjs-components/queries/getDisplayNameByUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import { InputTextNode } from "roamjs-components/types/native";
import { getCleanCustomWorkflows } from "./core";
import lego from "./img/lego3blocks.png";
import type Marked from "marked-react";
import apiGet from "roamjs-components/util/apiGet";

type Props = {
  parentUid: string;
};

type Smartblocks = {
  uuid: string;
  name: string;
  tags: string[];
  img?: string;
  author: string;
  description?: string;
};

const Thumbnail = ({ src = lego }: { src?: string }): React.ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(80);
  const [width, setWidth] = useState(80);
  useEffect(() => {
    const dummyImage = new Image();
    dummyImage.src = src;
    dummyImage.style.visibility = "hidden";
    dummyImage.onload = () => {
      document.body.appendChild(dummyImage);
      const { clientWidth, clientHeight } = dummyImage;
      dummyImage.remove();
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;
        if (clientWidth / clientHeight < containerWidth / containerHeight) {
          setHeight(containerHeight);
          setWidth((containerHeight * clientWidth) / clientHeight);
        } else if (
          clientWidth / clientHeight >
          containerWidth / containerHeight
        ) {
          setHeight((containerWidth * clientHeight) / clientWidth);
          setWidth(containerWidth);
        } else {
          setHeight(containerHeight);
          setWidth(containerWidth);
        }
      }
    };
  }, [containerRef, setHeight, setWidth, src]);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "80%",
        width: "100%",
      }}
      ref={containerRef}
    >
      <img
        style={{
          borderRadius: 4,
          height,
          width,
        }}
        src={src}
      />
    </div>
  );
};

const ROW_LENGTH = 2;
const DRAWER_TABS = ["Marketplace", "Installed", "Published"] as const;
type DrawerTab = typeof DRAWER_TABS[number];

const DrawerContent = ({
  parentUid,
  onClose,
  Markdown,
}: { onClose: () => void; Markdown: typeof Marked } & Props) => {
  const workflows = useMemo(getCleanCustomWorkflows, []);
  const [smartblocks, setSmartblocks] = useState<Smartblocks[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [installed, setInstalled] = useState(false);
  const [updateable, setUpdateable] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [numberOfDownloads, setNumberOfDownloads] = useState(0);
  const [
    selectedSmartBlockAuthorDisplayName,
    setSelectedSmartBlockAuthorDisplayName,
  ] = useState("");
  const [tabId, setTabId] = useState<DrawerTab>("Marketplace");
  const [search, setSearch] = useState("");
  const filteredSmartblocks = useMemo(() => {
    const regex = new RegExp(search, "i");
    return smartblocks.filter(
      (f) =>
        regex.test(f.name) ||
        regex.test(f.description) ||
        f.tags.some((s) => regex.test(s)) ||
        regex.test(f.author) ||
        (users[f.author] && regex.test(users[f.author]))
    );
  }, [smartblocks, search, tabId, users]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSmartBlockId, setSelectedSmartBlockId] = useState("");
  const selectedSmartBlock = useMemo(
    () => smartblocks.find(({ uuid }) => uuid === selectedSmartBlockId),
    [selectedSmartBlockId, smartblocks]
  );
  useEffect(() => {
    if (!selectedSmartBlockId) {
      setLoading(true);
      setError("");
      apiGet<{
        smartblocks: Smartblocks[];
        users: { author: string; displayName: string }[];
      }>({
        path: `smartblocks-store`,
        data: { tab: tabId, graph: window.roamAlphaAPI.graph.name },
        anonymous: true,
      })
        .then((r) => {
          setSmartblocks(r.smartblocks);
          setUsers(
            Object.fromEntries(
              r.users.map(({ author, displayName }) => [author, displayName])
            )
          );
        })
        .catch((e) => {
          setSmartblocks([]);
          setError(e.response?.data?.message || e.response?.data || e.message);
        })
        .finally(() => setLoading(false));
    }
  }, [setSmartblocks, setLoading, tabId, selectedSmartBlockId]);
  useEffect(() => {
    if (selectedSmartBlockId) {
      setLoading(true);
      setError("");
      apiGet<{
        installed: boolean;
        updatable: boolean;
        invalid: boolean;
        count: number;
        displayName: string;
      }>({
        path: `smartblocks-store`,
        data: {
          uuid: selectedSmartBlockId,
          graph: window.roamAlphaAPI.graph.name,
          open: `true`,
        },
        anonymous: true,
      })
        .then((r) => {
          const selectedName = selectedSmartBlock.name
            .replace(/<%[A-Z]+%>/g, "")
            .trim();
          setInstalled(
            r.installed && workflows.some((w) => w.name === selectedName)
          );
          setUpdateable(r.updatable);
          setInvalid(r.invalid);
          setNumberOfDownloads(r.count);
          setSelectedSmartBlockAuthorDisplayName(
            selectedSmartBlock.author === window.roamAlphaAPI.graph.name
              ? getSettingValueFromTree({
                  tree: getSubTree({
                    tree: getBasicTreeByParentUid(
                      getPageUidByPageTitle("roam/js/smartblocks")
                    ),
                    key: "publish",
                  }).children,
                  key: "display name",
                  defaultValue: getDisplayNameByUid(getCurrentUserUid()),
                })
              : r.displayName
          );
        })
        .catch((e) => {
          setLoading(false);
          setError(e.response?.data?.message || e.response?.data || e.message);
        })
        .finally(() => setLoading(false));
    } else {
      setUpdateable(false);
      setInstalled(false);
      setInvalid(false);
      setNumberOfDownloads(0);
      setSelectedSmartBlockAuthorDisplayName("");
    }
  }, [
    setUpdateable,
    setInstalled,
    setInvalid,
    selectedSmartBlockId,
    setNumberOfDownloads,
    setSelectedSmartBlockAuthorDisplayName,
    workflows,
  ]);
  const installWorkflow = useCallback(
    async (workflow: string) => {
      const children = JSON.parse(workflow) as InputTextNode[];
      const selectedName = selectedSmartBlock.name
        .replace(/<%[A-Z]+%>/g, "")
        .trim();
      const uid =
        workflows.find(({ name }) => name === selectedName)?.uid ||
        (await createBlock({
          node: {
            text: `#SmartBlock ${selectedSmartBlock.name}`,
          },
          parentUid,
        }));
      await getShallowTreeByParentUid(uid)
        .map(
          ({ uid: child }) =>
            () =>
              deleteBlock(child)
        )
        .reduce((p, c) => p.then(() => c()), Promise.resolve());
      await children
        .map(
          (node, order) => () => createBlock({ node, order, parentUid: uid })
        )
        .reduce((p, c) => p.then(() => c()), Promise.resolve());
      await window.roamAlphaAPI.ui.mainWindow.openBlock({ block: { uid } });
      onClose();
    },
    [selectedSmartBlock, onClose]
  );
  const buttonOnClick = () => {
    setLoading(true);
    setError("");
    apiGet<{secret: string, workflow: string}>({
      path: `smartblocks-store`,
      data: {
        uuid: selectedSmartBlockId,
        graph: window.roamAlphaAPI.graph.name,
      },
      anonymous: true,
    })
      .then((r) => {
        if (r.secret) {
          setLoading(false);
        } else if (r.workflow) {
          return installWorkflow(r.workflow);
        } else {
          throw new Error("Returned empty response");
        }
      })
      .catch((e) => {
        setLoading(false);
        setError(e.response?.data?.message || e.response?.data || e.message);
      });
  };
  return selectedSmartBlockId ? (
    <div className={Classes.DRAWER_BODY} style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          margin: 20,
          height: 300,
          position: "relative",
        }}
      >
        <div style={{ height: "100%", width: "40%" }}>
          <Thumbnail src={selectedSmartBlock.img} />
        </div>
        <div style={{ height: "100%", width: "60%", marginLeft: 16 }}>
          <div>
            <span
              style={{ display: "inline-block", minWidth: 120 }}
              className={loading ? Classes.SKELETON : ""}
            >
              {installed && <i>Already Installed</i>}
            </span>
            <b
              style={{
                display: "inline-block",
                minWidth: 60,
                textAlign: "right",
              }}
            >
              {numberOfDownloads} <Icon icon={"cloud-download"} />
            </b>
          </div>
          <h6 className={loading ? Classes.SKELETON : ""}>
            {selectedSmartBlockAuthorDisplayName || selectedSmartBlock.author}
          </h6>
          <h1>{selectedSmartBlock.name.replace(/<%[A-Z]+%>/g, "").trim()}</h1>
          <div className="flex space-between items-center">
            <div className={loading ? Classes.SKELETON : ""}>
              <div className={"flex gap-4 items-center"}>
                {updateable ? (
                  <Button
                    className={"flex-shrink-0 my-4"}
                    text={"Update"}
                    intent={Intent.WARNING}
                    onClick={buttonOnClick}
                  />
                ) : (
                  <Button
                    className={"flex-shrink-0 my-4"}
                    text={"Install"}
                    disabled={installed}
                    intent={Intent.PRIMARY}
                    onClick={buttonOnClick}
                  />
                )}
                <span className="inline-block text-xs text-yellow-900">
                  {invalid &&
                    "WARNING: This workflow contains illegal commands. Please notify the author before downloading."}
                </span>
              </div>
            </div>
            <div style={{ minWidth: 24 }}>
              {loading && <Spinner size={SpinnerSize.SMALL} />}
            </div>
          </div>
          <div style={{ color: "darkred" }}>{error}</div>
          <h6>About</h6>
          <Markdown>
            {selectedSmartBlock.description || "No Description"}
          </Markdown>
          <h6>Tags</h6>
          <ul>
            {selectedSmartBlock.tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
      <Button
        icon={"arrow-left"}
        onClick={() => {
          setSelectedSmartBlockId("");
        }}
        minimal
        style={{ position: "absolute", top: 8, right: 8 }}
      />
    </div>
  ) : (
    <>
      <div className="flex-shrink-0">
        <Tabs
          id={"smartblocks-store"}
          selectedTabId={tabId}
          onChange={(e) => setTabId(e as DrawerTab)}
          className={"roamjs-smartblocks-store-tabs"}
        >
          {DRAWER_TABS.map((id) => (
            <Tab key={id} title={id} id={id} />
          ))}
        </Tabs>
      </div>
      <div
        className={`${Classes.DRAWER_BODY} gap-8 grid p-2`}
        style={{
          gridTemplateColumns: `repeat(${ROW_LENGTH}, 1fr)`,
          gridTemplateRows: `repeat(${Math.ceil(
            filteredSmartblocks.length / ROW_LENGTH
          )}, 160px)`,
        }}
      >
        {loading ? (
          <Spinner />
        ) : !filteredSmartblocks.length ? (
          <div style={{ padding: 16 }}>
            <H6>No SmartBlocks Found.</H6>
            <p style={{ color: "darkred" }}>{error}</p>
          </div>
        ) : (
          filteredSmartblocks.map((e, i) => {
            const gridColumnStart = (i + 1) % ROW_LENGTH || ROW_LENGTH;
            return (
              <div
                key={e.uuid}
                className={`roamjs-smartblocks-store-item`}
                style={{
                  gridColumnStart: `${gridColumnStart}`,
                  gridColumnEnd: `${gridColumnStart + 1}`,
                }}
                onClick={() => setSelectedSmartBlockId(e.uuid)}
              >
                <Thumbnail src={e.img} />
                <div
                  className={"roamjs-smartblocks-store-label"}
                  style={{
                    height: "20%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Tooltip content={e.name} minimal targetTagName={"b"}>
                    {e.name}
                  </Tooltip>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className={Classes.DRAWER_FOOTER}>
        <InputGroup
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            "Search Smartblock by name, description, tags, or author..."
          }
        />
      </div>
    </>
  );
};

const SmartblocksStore =
  (Markdown: typeof Marked) =>
  ({ onClose, ...props }: { onClose: () => void } & Props) => {
    return (
      <Drawer
        title={"RoamJS Smartblocks Store"}
        position={Position.LEFT}
        onClose={onClose}
        isOpen={true}
        autoFocus={false}
        style={{ zIndex: 1000, minWidth: 640 }}
      >
        <DrawerContent {...props} onClose={onClose} Markdown={Markdown} />
      </Drawer>
    );
  };

export const render = (props: Props) =>
  (window.RoamLazy
    ? window.RoamLazy.MarkedReact()
    : import("marked-react").then((r) => r.default)
  ).then((Markdown) =>
    createOverlayRender<Props>(
      "marketplace-drawer",
      SmartblocksStore(Markdown)
    )(props)
  );

export default SmartblocksStore;
