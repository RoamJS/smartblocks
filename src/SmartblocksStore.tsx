import {
  Button,
  Classes,
  Drawer,
  H6,
  InputGroup,
  Position,
  Spinner,
  Tooltip,
} from "@blueprintjs/core";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createOverlayRender } from "roamjs-components";
import axios from "axios";
import {
  createBlock,
  extractTag,
  getRoamUrl,
  InputTextNode,
} from "roam-client";
import { getCustomWorkflows } from "./smartblocks";

type Props = {
  parentUid: string;
};

type Smartblocks = {
  uuid: string;
  name: string;
  tags: string[];
  price: number;
  img: string;
  author: string;
  description: string;
  workflow: string;
};

const Price = ({ price }: { price: number }) => (
  <b
    style={{
      color: "green",
      minWidth: "fit-content",
    }}
  >
    {price
      ? `$${Math.floor(price / 100)}.${(price % 100)
          .toString()
          .padStart(2, "0")}`
      : "FREE"}
  </b>
);

const Thumbnail = ({ src }: { src: string }): React.ReactElement => {
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
  }, [containerRef, setHeight, src]);
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

const ROW_LENGTH = 4;

const DrawerContent = ({
  parentUid,
  onClose,
}: { onClose: () => void } & Props) => {
  const [smartblocks, setSmartblocks] = useState<Smartblocks[]>([]);
  const installedSmartblocks = useMemo(
    () => new Set(getCustomWorkflows().map(({ name }) => name)),
    []
  );
  const [search, setSearch] = useState("");
  const filteredSmartblocks = useMemo(() => {
    const regex = new RegExp(search, "i");
    return smartblocks.filter(
      (f) =>
        regex.test(f.name) ||
        regex.test(f.description) ||
        f.tags.some((s) => regex.test(s)) ||
        regex.test(f.author)
    );
  }, [smartblocks, search]);
  const [loading, setLoading] = useState(true);
  const [selectedSmartBlockId, setSelectedSmartBlockId] = useState("");
  const selectedSmartBlock = useMemo(
    () => smartblocks.find(({ uuid }) => uuid === selectedSmartBlockId),
    [selectedSmartBlockId, smartblocks]
  );
  useEffect(() => {
    axios
      .get<{ smartblocks: Smartblocks[] }>(
        `${process.env.API_URL}/smartblocks-store`
      )
      .then((r) =>
        setSmartblocks(
          r.data.smartblocks.sort(({ name: a }, { name: b }) =>
            a.localeCompare(b)
          )
        )
      )
      .finally(() => setLoading(false));
  }, [setSmartblocks, setLoading]);
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
        <div style={{ height: "100%", width: "60%" }}>
          <Thumbnail src={selectedSmartBlock.img} />
        </div>
        <div style={{ height: "100%", width: "40%", marginLeft: 16 }}>
          <div>
            {installedSmartblocks.has(selectedSmartBlock.name) ? (
              <i>Already Installed</i>
            ) : (
              <Price price={selectedSmartBlock.price} />
            )}
          </div>
          <h6>{selectedSmartBlock.author}</h6>
          <h1>{selectedSmartBlock.name}</h1>
          <div>
            <Button
              style={{ margin: "16px 0" }}
              text={"Install"}
              disabled={installedSmartblocks.has(selectedSmartBlock.name)}
              onClick={() => {
                const children = JSON.parse(
                  selectedSmartBlock.workflow
                ) as InputTextNode[];
                const uid = createBlock({
                  node: {
                    text: `#SmartBlock ${selectedSmartBlock.name}`,
                    children,
                  },
                  parentUid,
                });
                onClose();
                setTimeout(() => window.location.assign(getRoamUrl(uid)), 1);
              }}
            />
          </div>
          <h6>About</h6>
          <p>{selectedSmartBlock.description}</p>
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
        onClick={() => setSelectedSmartBlockId("")}
        minimal
        style={{ position: "absolute", top: 8, right: 8 }}
      />
    </div>
  ) : (
    <>
      <div
        className={Classes.DRAWER_BODY}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${ROW_LENGTH}, 1fr)`,
          gridTemplateRows: `repeat(${Math.ceil(
            filteredSmartblocks.length / ROW_LENGTH
          )}, 160px)`,
        }}
      >
        {loading ? (
          <Spinner />
        ) : !filteredSmartblocks.length ? (
          <H6>No SmartBlocks Found.</H6>
        ) : (
          filteredSmartblocks.map((e, i) => {
            const gridColumnStart = (i + 1) % ROW_LENGTH || ROW_LENGTH;
            return (
              <div
                key={e.uuid}
                className={"roamjs-smartblocks-store-item"}
                style={{
                  gridColumnStart: `${gridColumnStart}`,
                  gridColumnEnd: `${gridColumnStart + 1}`,
                  ...(installedSmartblocks.has(e.name)
                    ? {
                        opacity: 0.8,
                        backgroundColor: "#80808080",
                        cursor: "not-allowed",
                      }
                    : {}),
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
                  {installedSmartblocks.has(e.name) ? (
                    <i>Installed</i>
                  ) : (
                    <Price price={e.price} />
                  )}
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

const SmartblocksStore = ({
  onClose,
  ...props
}: { onClose: () => void } & Props) => {
  return (
    <Drawer
      title={"RoamJS Smartblocks Store"}
      position={Position.LEFT}
      onClose={onClose}
      isOpen={true}
      style={{ zIndex: 1000, minWidth: 640 }}
    >
      <DrawerContent {...props} onClose={onClose} />
    </Drawer>
  );
};

export const render = createOverlayRender<Props>(
  "marketplace-drawer",
  SmartblocksStore
);

export default SmartblocksStore;
