import { APIGatewayProxyHandler } from "aws-lambda";
import { dynamo, headers, validToken } from "./common";

const REVIEWERS = ["dvargas92495"];

export const handler: APIGatewayProxyHandler = async (event) => {
  const { graph = "", uuid = "" } = JSON.parse(event.body || "{}");
  if (!uuid) {
    return {
      statusCode: 400,
      body: "uuid is required",
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
          }
        : !REVIEWERS.includes(graph)
        ? {
            statusCode: 401,
            body: `Only valid reviewers can approve`,
          }
        : dynamo
            .updateItem({
              TableName: "RoamJSSmartBlocks",
              Key: {
                uuid: { S: uuid },
              },
              UpdateExpression: "SET #s = :s",
              ExpressionAttributeNames: {
                "#s": "status",
              },
              ExpressionAttributeValues: {
                ":s": { S: "LIVE" },
              },
            })
            .promise()
            .then(() => ({
              statusCode: 200,
              body: JSON.stringify({
                success: true,
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
