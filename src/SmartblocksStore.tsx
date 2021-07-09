import {
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

type Props = {
  parentUid: string;
};

type Smartblocks = {
  name: string;
  tags: string[];
  price: number;
  img: string;
  author: string;
  description: string;
};

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
        height: "80%",
        width: "100%",
      }}
      ref={containerRef}
    >
      <img
        style={{
          borderRadius: 4,
          height,
        }}
        src={src}
      />
    </div>
  );
};

const ROW_LENGTH = 4;

const DrawerContent = ({ parentUid }: Props) => {
  const [smartblocks, setSmartblocks] = useState<Smartblocks[]>([]);
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
  useEffect(() => {
    //axios
    // .get<{ extensions: Smartblocks[] }>(`${process.env.API_URL}/marketplace`)
    Promise.resolve<{ data: { smartblocks: Smartblocks[] } }>({
      data: {
        smartblocks: [
          {
            name: "TEST Daily",
            description: "asdf",
            price: 0,
            author: "David Vargas",
            tags: ["daily", "productivity"],
            img: "https://roamjs.com/thumbnails/alert.png",
          },
          {
            name: "TEST Algorithm of Thought",
            description: "asdf",
            price: 500,
            author: "David Vargas",
            tags: ["thought", "thinking"],
            img: "https://roamjs.com/thumbnails/roam42.png",
          },
          {
            name: "TEST Email",
            description: "asdf",
            price: 1000,
            author: "David Vargas",
            tags: ["email", "writing"],
            img: "https://roamjs.com/thumbnails/smartblocks.png",
          },
          {
            name: "TEST Blog Post",
            description: "asdf",
            price: 750,
            author: "David Vargas",
            tags: ["writing"],
            img: "https://roamjs.com/thumbnails/twitter.png",
          },
        ],
      },
    })
      .then((r) =>
        setSmartblocks(
          r.data.smartblocks.sort(({ name: a }, { name: b }) =>
            a.localeCompare(b)
          )
        )
      )
      .finally(() => setLoading(false));
  }, [setSmartblocks, setLoading]);
  return (
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
                key={e.name}
                className={"roamjs-smartblocks-store-item"}
                style={{
                  gridColumnStart: `${gridColumnStart}`,
                  gridColumnEnd: `${gridColumnStart + 1}`,
                }}
              >
                <Thumbnail src={e.img} />
                <div
                  className={'roamjs-smartblocks-store-label'}
                  style={{
                    height: "20%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Tooltip
                    content={e.name}
                    minimal
                    targetTagName={"b"}
                  >
                    {e.name}
                  </Tooltip>
                  <b
                    style={{
                      color: "green",
                      minWidth: "fit-content",
                    }}
                  >
                    {e.price
                      ? `$${Math.floor(e.price / 100)}.${(e.price % 100)
                          .toString()
                          .padStart(2, "0")}`
                      : "FREE"}
                  </b>
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
      <DrawerContent {...props} />
    </Drawer>
  );
};

export const render = createOverlayRender<Props>(
  "marketplace-drawer",
  SmartblocksStore
);

export default SmartblocksStore;
