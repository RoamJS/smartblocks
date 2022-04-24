import { APIGatewayProxyHandler } from "aws-lambda";
import { headers, dynamo, validToken, toStatus } from "./common";

export const handler: APIGatewayProxyHandler = async (event) => {
  const { uuid = "", graph = "" } = event.queryStringParameters || {};
  if (!uuid) {
    return {
      statusCode: 400,
      body: "Argument `uuid` is required",
      headers,
    };
  }
  if (!graph) {
    return {
      statusCode: 400,
      body: "Argument `graph` is required",
      headers,
    };
  }
  return dynamo
    .getItem({
      TableName: "RoamJSSmartBlocks",
      Key: { uuid: { S: graph } },
    })
    .promise()
    .then((r) =>
      !validToken(event, r.Item)
        ? {
            statusCode: 401,
            body: `Token unauthorized for creating workflows from graph ${graph}`,
            headers,
          }
        : Promise.all([
            dynamo
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
              .then((q) => {
                const uuids = (q.Items || []).map((u) => u.uuid.S);
                const batches = Math.ceil(uuids.length / 25);
                const requests = new Array(batches)
                  .fill(null)
                  .map((_, i, all) =>
                    new Array(i === all.length - 1 ? uuids.length % 25 : 25)
                      .fill(null)
                      .map((_, j) => ({
                        uuid: { S: uuids[i * 25 + j] },
                      }))
                  );
                return Promise.all(
                  requests.map((req) =>
                    dynamo
                      .batchWriteItem({
                        RequestItems: {
                          RoamJSSmartBlocks: req.map((Key) => ({
                            DeleteRequest: { Key },
                          })),
                        },
                      })
                      .promise()
                  )
                );
              }),
            dynamo
              .deleteItem({
                TableName: "RoamJSSmartBlocks",
                Key: { uuid: { S: uuid } },
              })
              .promise(),
          ]).then(() => ({
            statusCode: 204,
            body: "{}",
            headers,
          }))
    )
    .catch((e) => ({
      statusCode: 500,
      body: e.message,
      headers,
    }));
};
