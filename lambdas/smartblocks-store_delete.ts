import { APIGatewayProxyHandler } from "aws-lambda";
import { dynamo, toStatus } from "./common";
import { awsGetRoamJSUser } from "roamjs-components/backend/getRoamJSUser";
import headers from "roamjs-components/backend/headers";

export const handler: APIGatewayProxyHandler = awsGetRoamJSUser(
  async (user, { uuid, graph }: Record<string, string>) => {
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
    const expectedUserId = await dynamo
      .getItem({
        TableName: "RoamJSSmartBlocks",
        Key: { uuid: { S: graph } },
      })
      .promise()
      .then((i) => i.Item?.token?.S);
    if (expectedUserId !== user.id) {
      return {
        statusCode: 403,
        body: "User does not have permission to remove this workflow.",
        headers,
      };
    }
    return Promise.all([
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
          const requests = new Array(batches).fill(null).map((_, i, all) =>
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
    ])
      .then(() => ({
        statusCode: 204,
        body: "{}",
        headers,
      }))
      .catch((e) => ({
        statusCode: 500,
        body: e.message,
        headers,
      }));
  }
);
