import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDB } from "aws-sdk";
import nanoid from "nanoid";
import {
  s3,
  dynamo,
  headers,
  toStatus,
  fromStatus,
  isInvalid,
} from "./common";

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

export const handler: APIGatewayProxyHandler = async (event) => {
  const {
    uuid = "",
    tab = "marketplace",
    graph = "",
    open,
  } = event.queryStringParameters || {};
  const filterTab = TAB_REGEX.test(tab) ? tab.toLowerCase() : "marketplace";
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
              }),
              headers,
            }));
          }
          return getWorkflow({ item: r.Item, graph, installs });
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
