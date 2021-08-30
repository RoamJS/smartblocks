import { APIGatewayProxyHandler } from "aws-lambda";
import AWS, { DynamoDB } from "aws-sdk";
import Stripe from "stripe";
import { v4 } from "uuid";
import fs from "fs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2020-08-27",
  maxNetworkRetries: 3,
});
const dynamo = new AWS.DynamoDB({
  apiVersion: "2012-08-10",
  region: "us-east-1",
});
const s3 = new AWS.S3({
  apiVersion: "2006-03-01",
  region: "us-east-1",
});
const headers = {
  "Access-Control-Allow-Origin": "https://roamresearch.com",
  "Access-Control-Allow-Methods": "GET",
};

const getWorkflow = (item: DynamoDB.AttributeMap, graph: string) =>
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
            uuid: { S: v4() },
            name: { S: item.uuid.S },
            author: { S: graph },
            workflow: { S: item.workflow.S },
            status: { S: "INSTALLED" },
          },
        })
        .promise()
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

export const handler: APIGatewayProxyHandler = async (event) => {
  const {
    uuid = "",
    tab = "marketplace",
    graph = "",
    open,
  } = event.queryStringParameters || {};
  const paymentIntentId =
    event.headers.Authorization || event.headers.authorization || "";
  const filterTab = TAB_REGEX.test(tab) ? tab.toLowerCase() : "marketplace";
  return uuid
    ? dynamo
        .getItem({
          TableName: "RoamJSSmartBlocks",
          Key: { uuid: { S: uuid } },
        })
        .promise()
        .then((r) =>
          r.Item?.status?.S !== "LIVE"
            ? {
                statusCode: 400,
                body: `Invalid id ${uuid} doesn't represent a LIVE SmartBlock Workflow`,
              }
            : !!open
            ? dynamo
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
                .then((i) => ({
                  statusCode: 200,
                  body: JSON.stringify({
                    installed: !!i.Count,
                    updatable:
                      !!i.Count &&
                      i.Items.reduce(
                        (prev, cur) =>
                          cur.workflow.S.localeCompare(prev.workflow.S) > 0
                            ? cur
                            : prev,
                        { workflow: { S: "0000" } }
                      ).workflow?.S !== r.Item.workflow.S,
                  }),
                  headers,
                }))
            : (Number(r.Item?.price?.N) || 0) <= 0
            ? getWorkflow(r.Item, graph)
            : !!paymentIntentId
            ? stripe.paymentIntents.retrieve(paymentIntentId).then((p) =>
                p.status === "succeeded"
                  ? getWorkflow(r.Item, graph)
                  : {
                      statusCode: 401,
                      body: `Invalid payment id`,
                      headers,
                    }
              )
            : dynamo
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
                  i.Count > 0
                    ? getWorkflow(r.Item, graph)
                    : dynamo
                        .getItem({
                          TableName: "RoamJSSmartBlocks",
                          Key: { uuid: { S: r.Item.author.S } },
                        })
                        .promise()
                        .then((t) =>
                          stripe.paymentIntents.create({
                            payment_method_types: ["card"],
                            amount: Number(r.Item?.price?.N),
                            currency: "usd",
                            application_fee_amount:
                              30 + Math.ceil(Number(r.Item?.price?.N) * 0.08),
                            transfer_data: {
                              destination: t.Item.stripe.S,
                            },
                          })
                        )
                        .then((s) => ({
                          statusCode: 200,
                          body: JSON.stringify({ secret: s.client_secret }),
                          headers,
                        }))
                )
        )
        .catch((e) => ({
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            message: e.message,
          }),
          headers,
        }))
    : (filterTab === "installed"
        ? dynamo
            .query({
              TableName: "RoamJSSmartBlocks",
              IndexName: "status-author-index",
              ExpressionAttributeNames: {
                "#s": "status",
                "#a": "author",
              },
              ExpressionAttributeValues: {
                ":s": { S: "INSTALLED" },
                ":a": { S: graph },
              },
              KeyConditionExpression: "#a = :a AND #s = :s",
            })
            .promise()
            .then((is) => {
              const uuids = Array.from(new Set(is.Items.map(u => u.name.S)))
              const batches = Math.ceil(uuids.length / 100);
              const requests = new Array(batches).fill(null).map((_, i, all) =>
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
                ":s": { S: "LIVE" },
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
                ":s": { S: "LIVE" },
              },
              KeyConditionExpression: "#s = :s",
            })
            .promise()
            .then((r) => r.Items)
      )
        .then((items) => ({
          statusCode: 200,
          body: JSON.stringify({
            smartblocks: items.map((i) =>
              Object.fromEntries(
                Object.entries(i)
                  .filter(([k]) => k !== "workflow")
                  .map(([k, v]) => [k, v.N ? Number(v.N) : v.S || v.SS])
              )
            ),
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
