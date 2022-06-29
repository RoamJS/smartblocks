import { Button, Intent, Spinner, SpinnerSize } from "@blueprintjs/core";
import axios from "axios";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import getFirstChildTextByBlockUid from "roamjs-components/queries/getFirstChildTextByBlockUid";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import localStorageGet from "roamjs-components/util/localStorageGet";
import localStorageSet from "roamjs-components/util/localStorageSet";
import toFlexRegex from "roamjs-components/util/toFlexRegex";

const width = 600;
const height = 525;
const StripePanel = ({ parentUid }: { uid?: string; parentUid: string }) => {
  const [connected, setConnected] = useState(!!localStorageGet("stripe"));
  const [showRetry, setShowRetry] = useState(false);
  const tokenUid = useMemo(
    () =>
      getShallowTreeByParentUid(parentUid).find((t) =>
        toFlexRegex("token").test(t.text)
      )?.uid,
    [parentUid]
  );
  const token = useMemo(
    () => tokenUid && getFirstChildTextByBlockUid(tokenUid),
    [tokenUid]
  );
  const opts = useMemo(() => ({ headers: { Authorization: token } }), [token]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const intervalListenerRef = useRef(0);
  const pollStripeAccount = useCallback(() => {
    const connectInterval = () => {
      axios
        .post(
          `${process.env.API_URL}/smartblocks-token`,
          { operation: "FINISH", author: window.roamAlphaAPI.graph.name },
          opts
        )
        .then((r) => {
          if (r.data.done) {
            setConnected(true);
            localStorageSet("stripe", "true");
            setShowRetry(false);
            setLoading(false);
            window.clearTimeout(intervalListenerRef.current);
          } else {
            setShowRetry(true);
            intervalListenerRef.current = window.setTimeout(
              connectInterval,
              1000
            );
          }
        })
        .catch((e) => {
          if (e.response?.status !== 400) {
            intervalListenerRef.current = window.setTimeout(
              connectInterval,
              1000
            );
          } else {
            setLoading(false);
          }
          setShowRetry(false);
        });
    };
    setLoading(true);
    connectInterval();
  }, [setConnected, setLoading, opts, setShowRetry, intervalListenerRef]);
  const stripeConnectOnClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (loading) {
        return;
      }
      setError("");
      setLoading(true);
      axios
        .post(
          `${process.env.API_URL}/smartblocks-token`,
          { operation: "CREATE", author: window.roamAlphaAPI.graph.name },
          opts
        )
        .then((r) => {
          const left = window.screenX + (window.innerWidth - width) / 2;
          const top = window.screenY + (window.innerHeight - height) / 2;
          window.open(
            r.data.url,
            `roamjs:smartblocks:connect`,
            `left=${left},top=${top},width=${width},height=${height},status=1`
          );
          pollStripeAccount();
        })
        .catch((e) => {
          setError(e.response?.data || e.message);
        });
    },
    [setLoading, setError, loading, pollStripeAccount, opts]
  );
  const stripeRetryOnClick = useCallback(
    () =>
      axios
        .post(
          `${process.env.API_URL}/smartblocks-token`,
          { operation: "RETRY", author: window.roamAlphaAPI.graph.name },
          opts
        )
        .then((r) => {
          const left = window.screenX + (window.innerWidth - width) / 2;
          const top = window.screenY + (window.innerHeight - height) / 2;
          window.open(
            r.data.url,
            `roamjs:smartblocks:connect`,
            `left=${left},top=${top},width=${width},height=${height},status=1`
          );
        })
        .catch((e) => {
          setError(e.response?.data || e.message);
          setShowRetry(false);
        }),
    [setError, opts, setShowRetry]
  );
  useEffect(() => {
    if (!connected && token) {
      pollStripeAccount();
    }
    return () => window.clearTimeout(intervalListenerRef.current);
  }, [connected, token, pollStripeAccount, intervalListenerRef]);
  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 16,
        }}
      >
        {!token ? (
          <span>Must first generate a token to connect with Stripe</span>
        ) : !connected ? (
          <>
            <a
              href="#"
              className={`stripe-connect${loading ? " disabled" : ""}`}
              onClick={stripeConnectOnClick}
            >
              <span>Connect with</span>
            </a>
            {showRetry && (
              <div style={{ marginTop: 8 }}>
                <p>
                  If your country is not currently supported, reach out to
                  support@roamjs.com to inquire about supporting your country.
                </p>
                <p>
                  If you close out of the Stripe window, feel free to try again
                  here:
                </p>
                <Button
                  intent={Intent.WARNING}
                  text={"Retry"}
                  onClick={stripeRetryOnClick}
                />
              </div>
            )}
          </>
        ) : (
          <span>Connected with Stripe</span>
        )}
        {loading && <Spinner size={SpinnerSize.SMALL} />}
      </div>
      <div style={{ color: "darkred" }}>{error}</div>
    </>
  );
};

export default StripePanel;
