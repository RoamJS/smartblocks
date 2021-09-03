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
import {
  createOverlayRender,
  getSettingValueFromTree,
  getSubTree,
  renderToast,
} from "roamjs-components";
import axios from "axios";
import {
  createBlock,
  deleteBlock,
  getBasicTreeByParentUid,
  getCurrentPageUid,
  getCurrentUserDisplayName,
  getCurrentUserEmail,
  getCurrentUserUid,
  getDisplayNameByUid,
  getGraph,
  getPageUidByPageTitle,
  getRoamUrl,
  getShallowTreeByParentUid,
  InputTextNode,
} from "roam-client";
import Markdown from "markdown-to-jsx";
import {
  Elements,
  CardElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { getCustomWorkflows } from "./smartblocks";
import lego from "./img/lego3blocks.png";

const stripePromise = loadStripe(process.env.STRIPE_PUBLIC_KEY);

type Props = {
  parentUid: string;
};

type Smartblocks = {
  uuid: string;
  name: string;
  tags: string[];
  price: number;
  img?: string;
  author: string;
  description?: string;
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

const StripeCheckout = ({
  secret,
  setLoading,
  setError,
  onSuccess,
  loading,
  isDonation,
}: {
  secret: string;
  setLoading: (f: boolean) => void;
  setError: (m: string) => void;
  onSuccess: (id: string) => void;
  loading: boolean;
  isDonation: boolean;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const handleSubmit = useCallback(() => {
    setLoading(true);
    const name = getCurrentUserDisplayName();
    stripe
      .confirmCardPayment(secret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: {
            ...(name ? { name } : {}),
            email: getCurrentUserEmail(),
          },
        },
      })
      .then((s) => {
        if (s.error) {
          throw new Error(s.error.message);
        } else {
          onSuccess(s.paymentIntent.id);
        }
      })
      .catch((e) => {
        setLoading(false);
        setError(e.message);
      });
  }, [stripe, setLoading, secret]);
  return (
    <div
      style={{
        flexGrow: 1,
        background: "#eeeeee",
        padding: 4,
        borderRadius: 4,
      }}
    >
      <Label>
        Card Details
        <CardElement
          options={{
            style: {
              base: {
                color: "#32325d",
                fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                fontSmoothing: "antialiased",
                fontSize: "16px",
                "::placeholder": {
                  color: "#aab7c4",
                },
              },
              invalid: {
                color: "#fa755a",
                iconColor: "#fa755a",
              },
            },
          }}
        />
      </Label>
      <Button
        style={{ margin: "16px 0" }}
        text={isDonation ? "Donate" : "Buy SmartBlock"}
        disabled={loading}
        intent={Intent.PRIMARY}
        onClick={handleSubmit}
      />
    </div>
  );
};

const ROW_LENGTH = 4;
const DRAWER_TABS = ["Marketplace", "Installed", "Published"] as const;
type DrawerTab = typeof DRAWER_TABS[number];
const graph = getGraph();

const DrawerContent = ({
  parentUid,
  onClose,
}: { onClose: () => void } & Props) => {
  const [smartblocks, setSmartblocks] = useState<Smartblocks[]>([]);
  const [installed, setInstalled] = useState(false);
  const [updateable, setUpdateable] = useState(false);
  const [donatable, setDonatable] = useState(false);
  const [numberOfDownloads, setNumberOfDownloads] = useState(0);
  const [
    selectedSmartBlockAuthorDisplayName,
    setSelectedSmartBlockAuthorDisplayName,
  ] = useState("");
  const [donation, setDonation] = useState(0);
  const [tabId, setTabId] = useState<DrawerTab>("Marketplace");
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
  }, [smartblocks, search, tabId]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSmartBlockId, setSelectedSmartBlockId] = useState("");
  const selectedSmartBlock = useMemo(
    () => smartblocks.find(({ uuid }) => uuid === selectedSmartBlockId),
    [selectedSmartBlockId, smartblocks]
  );
  const [paymentSecret, setPaymentSecret] = useState("");
  useEffect(() => {
    if (!selectedSmartBlockId) {
      setLoading(true);
      setError("");
      axios
        .get<{ smartblocks: Smartblocks[] }>(
          `${process.env.API_URL}/smartblocks-store?tab=${tabId}&graph=${graph}`
        )
        .then((r) =>
          setSmartblocks(
            r.data.smartblocks.sort(({ name: a }, { name: b }) =>
              a.localeCompare(b)
            )
          )
        )
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
      axios
        .get(
          `${process.env.API_URL}/smartblocks-store?uuid=${selectedSmartBlockId}&graph=${graph}&open=true`
        )
        .then((r) => {
          setInstalled(r.data.installed);
          setUpdateable(r.data.updatable);
          setDonatable(r.data.donatable);
          setNumberOfDownloads(r.data.count);
          setSelectedSmartBlockAuthorDisplayName(
            selectedSmartBlock.author === getGraph()
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
              : r.data.displayName
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
      setDonatable(false);
      setNumberOfDownloads(0);
      setSelectedSmartBlockAuthorDisplayName("");
    }
    setDonation(0);
  }, [
    setUpdateable,
    setInstalled,
    setDonatable,
    selectedSmartBlockId,
    setDonation,
    setNumberOfDownloads,
    setSelectedSmartBlockAuthorDisplayName,
  ]);
  const installWorkflow = useCallback(
    (workflow: string) => {
      const children = JSON.parse(workflow) as InputTextNode[];
      const uid =
        getCustomWorkflows().find(
          ({ name }) => name === selectedSmartBlock.name
        )?.uid ||
        createBlock({
          node: {
            text: `#SmartBlock ${selectedSmartBlock.name}`,
          },
          parentUid,
        });
      setTimeout(() => {
        getShallowTreeByParentUid(uid).forEach(({ uid: child }) =>
          deleteBlock(child)
        );
        children.forEach((node, order) =>
          createBlock({ node, order, parentUid: uid })
        );
        setTimeout(() => {
          window.location.assign(getRoamUrl(uid));
          onClose();
        }, 1000);
      }, 1);
    },
    [selectedSmartBlock, onClose]
  );
  const buttonOnClick = () => {
    setLoading(true);
    setError("");
    axios
      .get(
        `${process.env.API_URL}/smartblocks-store?uuid=${selectedSmartBlockId}&graph=${graph}&donation=${donation}`
      )
      .then((r) => {
        if (r.data.secret) {
          setPaymentSecret(r.data.secret);
          setLoading(false);
        } else if (r.data.workflow) {
          installWorkflow(r.data.workflow);
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
              {installed ? (
                <i>Already Installed</i>
              ) : (
                <Price price={selectedSmartBlock.price} />
              )}
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
          <h1>{selectedSmartBlock.name}</h1>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {paymentSecret ? (
              <Elements stripe={stripePromise}>
                <StripeCheckout
                  secret={paymentSecret}
                  isDonation={!!donation}
                  onSuccess={(id: string) =>
                    axios
                      .get(
                        `${process.env.API_URL}/smartblocks-store?uuid=${selectedSmartBlockId}&graph=${graph}`,
                        {
                          headers: { Authorization: id },
                        }
                      )
                      .then((r) => {
                        renderToast({
                          id: "smartblock-store-success",
                          intent: Intent.SUCCESS,
                          content: `Successfully ${
                            donation ? "Dontated Towards" : "Bought"
                          } SmartBlock!`,
                        });
                        if (updateable || !installed) {
                          installWorkflow(r.data.workflow);
                        } else {
                          onClose();
                        }
                      })
                      .catch((e) => {
                        setLoading(false);
                        setError(
                          e.response?.data?.message ||
                            e.response?.data ||
                            e.message
                        );
                      })
                  }
                  setError={setError}
                  setLoading={setLoading}
                  loading={loading}
                />
              </Elements>
            ) : (
              <div className={loading ? Classes.SKELETON : ""}>
                {donatable && (
                  <>
                    <h6>Thank the author by sending them a donation!</h6>
                    <NumericInput
                      leftIcon={"dollar"}
                      min={0}
                      step={1}
                      value={donation}
                      onValueChange={(e) => setDonation(e)}
                    />
                  </>
                )}
                {updateable ? (
                  <Button
                    style={{ margin: "16px 0" }}
                    text={"Update"}
                    intent={Intent.WARNING}
                    onClick={buttonOnClick}
                  />
                ) : installed && donatable ? (
                  <Button
                    style={{ margin: "16px 0" }}
                    text={"Donate"}
                    intent={Intent.SUCCESS}
                    onClick={buttonOnClick}
                  />
                ) : (
                  <Button
                    style={{ margin: "16px 0" }}
                    text={"Install"}
                    disabled={installed}
                    intent={Intent.PRIMARY}
                    onClick={buttonOnClick}
                  />
                )}
              </div>
            )}
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
          setPaymentSecret("");
        }}
        minimal
        style={{ position: "absolute", top: 8, right: 8 }}
      />
    </div>
  ) : (
    <>
      <div>
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
                  {tabId !== "Installed" && <Price price={e.price} />}
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
