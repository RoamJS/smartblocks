import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDB } from "aws-sdk";
import Stripe from "stripe";
import nanoid from "nanoid";
import {
  s3,
  dynamo,
  headers,
  stripe,
  ses,
  toStatus,
  fromStatus,
  isInvalid,
} from "./common";

const oldStripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2020-08-27",
  maxNetworkRetries: 3,
});

const getWorkflow = ({
  item,
  graph,
  installs,
}: {
  item: DynamoDB.AttributeMap;
  graph: string;
  installs: number;
}) =>
  s3
    .getObject({
      Bucket: "roamjs-smartblocks",
      Key: `${item.uuid.S}/${item.workflow.S}.json`,
    })
    .promise()
    .then((r) =>
      dynamo
        .putItem({
          TableName: "RoamJSSmartBlocks",
          Item: {
            uuid: { S: nanoid() },
            name: { S: item.uuid.S },
            author: { S: graph },
            workflow: { S: item.workflow.S },
            status: { S: toStatus("INSTALLED") },
          },
        })
        .promise()
        .then(() =>
          dynamo
            .updateItem({
              TableName: "RoamJSSmartBlocks",
              Key: {
                uuid: { S: item.uuid.S },
              },
              UpdateExpression: "SET #s = :s",
              ExpressionAttributeNames: {
                "#s": "score",
              },
              ExpressionAttributeValues: {
                ":s": { N: (installs + 1).toString() },
              },
            })
            .promise()
        )
        .then(() => ({
          statusCode: 200,
          body: JSON.stringify({ workflow: r.Body.toString() }),
          headers,
        }))
    );

const TAB_REGEX = new RegExp(
  `^(${["Marketplace", "Installed", "Published"].join("|")})$`,
  "i"
);

const ensureCustomer = (email: string): Promise<string | undefined> => {
  if (!email) {
    return Promise.resolve(undefined);
  }
  return stripe.customers
    .list({ email })
    .then((c) =>
      c.data.length
        ? c.data[0].id
        : stripe.customers.create({ email }).then((c) => c.id)
    )
    .catch(() => undefined);
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const {
    uuid = "",
    tab = "marketplace",
    graph = "",
    open,
    donation = "0",
  } = event.queryStringParameters || {};
  const authorization =
    event.headers.Authorization || event.headers.authorization || "";
  const paymentIntentId = authorization.startsWith("email:")
    ? ""
    : authorization;
  const email = authorization.startsWith("email:")
    ? authorization.slice(6)
    : "";
  const filterTab = TAB_REGEX.test(tab) ? tab.toLowerCase() : "marketplace";
  const donationValue = (Number(donation) || 0) * 100;
  if (donationValue > 0 && donationValue < 1) {
    return {
      statusCode: 400,
      body: `Invalid donation amount. Any donation must be at least $1.`,
      headers,
    };
  }
  return uuid
    ? dynamo
        .getItem({
          TableName: "RoamJSSmartBlocks",
          Key: { uuid: { S: uuid } },
        })
        .promise()
        .then(async (r) => {
          if (fromStatus(r.Item?.status?.S) !== "LIVE") {
            return {
              statusCode: 400,
              body: `Invalid id ${uuid} doesn't represent a LIVE SmartBlock Workflow`,
              headers,
            };
          }
          const installs = await dynamo
            .query({
              TableName: "RoamJSSmartBlocks",
              IndexName: "name-status-index",
              ExpressionAttributeNames: {
                "#s": "status",
                "#n": "name",
              },
              ExpressionAttributeValues: {
                ":s": { S: toStatus("INSTALLED") },
                ":n": { S: uuid },
              },
              KeyConditionExpression: "#n = :n AND #s = :s",
            })
            .promise()
            .then((is) => is.Count);
          if (!!open) {
            const invalid = await s3
              .getObject({
                Bucket: "roamjs-smartblocks",
                Key: `${r.Item.uuid.S}/${r.Item.workflow.S}.json`,
              })
              .promise()
              .then((d) => isInvalid(d.Body.toString()));
            if (graph === r.Item.author.S) {
              return {
                statusCode: 200,
                body: JSON.stringify({
                  installed: true,
                  updatable: false,
                  donatable: false,
                  count: installs,
                  invalid,
                }),
                headers,
              };
            }
            return Promise.all([
              dynamo
                .query({
                  TableName: "RoamJSSmartBlocks",
                  IndexName: "name-author-index",
                  ExpressionAttributeNames: {
                    "#s": "name",
                    "#a": "author",
                  },
                  ExpressionAttributeValues: {
                    ":s": { S: uuid },
                    ":a": { S: graph },
                  },
                  KeyConditionExpression: "#a = :a AND #s = :s",
                })
                .promise(),
              dynamo
                .getItem({
                  TableName: "RoamJSSmartBlocks",
                  Key: { uuid: { S: r.Item.author.S } },
                })
                .promise(),
            ]).then(async ([link, publisher]) => ({
              statusCode: 200,
              body: JSON.stringify({
                invalid,
                displayName: publisher.Item?.description?.S,
                count: installs,
                installed: !!link.Count,
                updatable:
                  !!link.Count &&
                  link.Items.reduce(
                    (prev, cur) =>
                      cur.workflow.S.localeCompare(prev.workflow.S) > 0
                        ? cur
                        : prev,
                    { workflow: { S: "0000" } }
                  ).workflow?.S !== r.Item.workflow.S,
                donatable:
                  (Number(r.Item?.price?.N) || 0) === 0 &&
                  !!publisher.Item?.stripe?.S
                    ? await oldStripe.accounts
                        .retrieve(publisher.Item.stripe.S)
                        .then((r) => r.details_submitted)
                        .catch(() => false)
                    : false,
              }),
              headers,
            }));
          }
          if (!!paymentIntentId) {
            return stripe.paymentIntents.retrieve(paymentIntentId).then((p) =>
              p.status === "succeeded"
                ? getWorkflow({ item: r.Item, graph, installs }).then(
                    async (response) => {
                      const noUser = {
                        name: "Anonymous User",
                        email: "",
                      };
                      return Promise.all([
                        oldStripe.accounts.retrieve(
                          p.transfer_data.destination as string
                        ),
                        p.customer
                          ? stripe.customers
                              .retrieve(p.customer as string)
                              .then((c) => (c as Stripe.Customer) || noUser)
                              .catch((e) => {
                                console.log(e);
                                return noUser;
                              })
                          : Promise.resolve(noUser),
                        stripe.paymentMethods.retrieve(
                          p.payment_method as string
                        ),
                      ])
                        .then(
                          ([a, c, pm]) =>
                            a.email &&
                            ses
                              .sendEmail({
                                Destination: {
                                  ToAddresses: [a.email],
                                },
                                Message: {
                                  Body: {
                                    Text: {
                                      Charset: "UTF-8",
                                      Data: `${
                                        c.name || noUser.name
                                      } just paid $${
                                        p.amount / 100
                                      } for your SmartBlock workflow ${
                                        r.Item?.name?.S
                                      }!\n\n${
                                        (c.email || pm.billing_details.email) &&
                                        `You could reach them at ${
                                          c.email || pm.billing_details.email
                                        } to say thanks!`
                                      }`,
                                    },
                                  },
                                  Subject: {
                                    Charset: "UTF-8",
                                    Data: `New RoamJS SmartBlock Purchase!`,
                                  },
                                },
                                Source: "support@roamjs.com",
                              })
                              .promise()
                        )
                        .then(() => response)
                        .catch((e) => {
                          console.log(e);
                          return response;
                        });
                    }
                  )
                : {
                    statusCode: 401,
                    body: `Invalid payment id`,
                    headers,
                  }
            );
          }
          const amount = Number(r.Item?.price?.N) || donationValue;
          if (amount <= 0) {
            return getWorkflow({ item: r.Item, graph, installs });
          }
          return dynamo
            .query({
              TableName: "RoamJSSmartBlocks",
              IndexName: "name-author-index",
              ExpressionAttributeNames: {
                "#s": "name",
                "#a": "author",
              },
              ExpressionAttributeValues: {
                ":s": { S: uuid },
                ":a": { S: graph },
              },
              KeyConditionExpression: "#a = :a AND #s = :s",
            })
            .promise()
            .then((i) =>
              i.Count > 0 && donationValue <= 0
                ? getWorkflow({ item: r.Item, graph, installs })
                : dynamo
                    .getItem({
                      TableName: "RoamJSSmartBlocks",
                      Key: { uuid: { S: r.Item.author.S } },
                    })
                    .promise()
                    .then((t) =>
                      ensureCustomer(email).then((customer) =>
                        stripe.paymentIntents.create({
                          automatic_payment_methods: { enabled: true },
                          amount,
                          currency: "usd",
                          application_fee_amount: 30 + Math.ceil(amount * 0.08),
                          transfer_data: {
                            destination: t.Item.stripe.S,
                          },
                          customer,
                        })
                      )
                    )
                    .then((s) => ({
                      statusCode: 200,
                      body: JSON.stringify({
                        secret: s.client_secret,
                        id: s.id,
                      }),
                      headers,
                    }))
            );
        })
        .catch((e) => ({
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            message: e.message,
          }),
          headers,
        }))
    : Promise.all([
        filterTab === "installed"
          ? dynamo
              .query({
                TableName: "RoamJSSmartBlocks",
                IndexName: "status-author-index",
                ExpressionAttributeNames: {
                  "#s": "status",
                  "#a": "author",
                },
                ExpressionAttributeValues: {
                  ":s": { S: toStatus("INSTALLED") },
                  ":a": { S: graph },
                },
                KeyConditionExpression: "#a = :a AND #s = :s",
              })
              .promise()
              .then((is) => {
                const uuids = Array.from(
                  new Set(is.Items.map((u) => u.name.S))
                );
                const batches = Math.ceil(uuids.length / 100);
                const requests = new Array(batches)
                  .fill(null)
                  .map((_, i, all) =>
                    new Array(i === all.length - 1 ? uuids.length % 100 : 100)
                      .fill(null)
                      .map((_, j) => ({
                        uuid: { S: uuids[i * 100 + j] },
                      }))
                  );
                return Promise.all(
                  requests.map((Keys) =>
                    dynamo
                      .batchGetItem({
                        RequestItems: { RoamJSSmartBlocks: { Keys } },
                      })
                      .promise()
                  )
                ).then((all) => {
                  return all.flatMap((a) => a.Responses.RoamJSSmartBlocks);
                });
              })
          : filterTab === "published"
          ? dynamo
              .query({
                TableName: "RoamJSSmartBlocks",
                IndexName: "status-author-index",
                ExpressionAttributeNames: {
                  "#s": "status",
                  "#a": "author",
                },
                ExpressionAttributeValues: {
                  ":s": { S: toStatus("LIVE") },
                  ":a": { S: graph },
                },
                KeyConditionExpression: "#a = :a AND #s = :s",
              })
              .promise()
              .then((r) => r.Items)
          : dynamo
              .query({
                TableName: "RoamJSSmartBlocks",
                IndexName: "status-index",
                ExpressionAttributeNames: {
                  "#s": "status",
                },
                ExpressionAttributeValues: {
                  ":s": { S: toStatus("LIVE") },
                },
                KeyConditionExpression: "#s = :s",
              })
              .promise()
              .then((r) => r.Items),
        dynamo
          .query({
            TableName: "RoamJSSmartBlocks",
            IndexName: "status-index",
            ExpressionAttributeNames: {
              "#s": "status",
            },
            ExpressionAttributeValues: {
              ":s": { S: toStatus("USER") },
            },
            KeyConditionExpression: "#s = :s",
          })
          .promise()
          .then((r) => r.Items),
      ])
        .then(([items, users]) => ({
          statusCode: 200,
          body: JSON.stringify({
            smartblocks: items
              .sort((a, b) => {
                const scoreDiff =
                  Number(b.score?.N || 0) - Number(a.score?.N || 0);
                if (!scoreDiff) {
                  return (a.name?.S || "").localeCompare(b?.name.S || "");
                }
                return Number(b.score?.N || 0) - Number(a.score?.N || 0);
              })
              .map((i) =>
                Object.fromEntries(
                  Object.entries(i)
                    .filter(([k]) => k !== "workflow")
                    .map(([k, v]) => [k, v.N ? Number(v.N) : v.S || v.SS])
                )
              ),
            users: users.map((i) => ({
              author: i.uuid.S,
              displayName: i.description?.S || "",
            })),
          }),
          headers,
        }))
        .catch((e) => ({
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            message: e.message,
          }),
          headers,
        }));
};
