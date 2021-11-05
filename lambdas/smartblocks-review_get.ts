import { APIGatewayProxyHandler } from "aws-lambda";
import { s3, dynamo, headers, validToken } from "./common";

const REVIEWERS = ["dvargas92495"];

export const handler: APIGatewayProxyHandler = async (event) => {
  const { graph = "", uuid = "" } = event.queryStringParameters || {};
  return dynamo
    .getItem({
      TableName: "RoamJSSmartBlocks",
      Key: { uuid: { S: graph } },
    })
    .promise()
    .then((r) =>
      r.Item?.status?.S !== "USER"
        ? {
            statusCode: 400,
            body: `Invalid id ${graph} doesn't represent a User`,
            headers,
          }
        : !validToken(event, r.Item)
        ? {
            statusCode: 401,
            body: `Invalid token with user`,
            headers,
          }
        : uuid && REVIEWERS.includes(graph)
        ? dynamo
            .getItem({
              TableName: "RoamJSSmartBlocks",
              Key: { uuid: { S: uuid } },
            })
            .promise()
            .then((i) =>
              s3
                .listObjectsV2({
                  Bucket: "roamjs-smartblocks",
                  Prefix: `${i.Item.uuid.S}/`,
                  Delimiter: "/",
                })
                .promise()
                .then((o) =>
                  Promise.all(
                    [
                      o.Contents.reverse()[0].Key,
                      ...(i.Item?.workflow?.S
                        ? [`${i.Item.uuid.S}/${i.Item.workflow.S}.json`]
                        : []),
                    ].map((Key) =>
                      s3
                        .getObject({ Bucket: "roamjs-smartblocks", Key })
                        .promise()
                        .then((b) => ({
                          version: Key.substring(i.Item.uuid.S.length + 1).replace(/\.json$/, ""),
                          workflow: b.Body.toString(),
                        }))
                    )
                  )
                )
                .then(([newWorkflow, oldWorkflow]) => ({
                  statusCode: 200,
                  body: JSON.stringify({
                    oldWorkflow,
                    newWorkflow,
                  }),
                  headers,
                }))
            )
        : (REVIEWERS.includes(graph)
            ? dynamo
                .query({
                  TableName: "RoamJSSmartBlocks",
                  IndexName: "status-index",
                  ExpressionAttributeNames: {
                    "#s": "status",
                  },
                  ExpressionAttributeValues: {
                    ":s": { S: "UNDER REVIEW" },
                  },
                  KeyConditionExpression: "#s = :s",
                })
                .promise()
                .then((i) => ({ ...i, reviewable: true }))
            : dynamo
                .query({
                  TableName: "RoamJSSmartBlocks",
                  IndexName: "status-author-index",
                  ExpressionAttributeNames: {
                    "#s": "status",
                    "#a": "author",
                  },
                  ExpressionAttributeValues: {
                    ":s": { S: "UNDER REVIEW" },
                    ":a": { S: graph },
                  },
                  KeyConditionExpression: "#a = :a AND #s = :s",
                })
                .promise()
                .then((i) => ({ ...i, reviewable: false }))
          ).then((i) => ({
            statusCode: 200,
            body: JSON.stringify({
              workflows: i.Items.map((w) => ({
                name: w.name.S,
                uuid: w.uuid.S,
              })),
              reviewable: i.reviewable,
            }),
            headers,
          }))
    )
    .catch((e) => ({
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: e.message,
      }),
      headers,
    }));
};
