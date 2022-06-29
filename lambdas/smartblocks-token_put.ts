import { APIGatewayProxyHandler } from "aws-lambda";
import { dynamo, fromStatus, headers, toStatus, validToken } from "./common";
import sha256 from "crypto-js/sha256";
import nanoid from "nanoid";

export const handler: APIGatewayProxyHandler = async (event) => {
  const { graph } = JSON.parse(event.body) as {
    graph: string;
  };
  return dynamo
    .getItem({
      TableName: "RoamJSSmartBlocks",
      Key: {
        uuid: {
          S: graph,
        },
      },
    })
    .promise()
    .then((r) => {
      if (
        (!r.Item || fromStatus(r.Item?.status?.S) === "USER") &&
        validToken(event, r.Item)
      ) {
        const newToken = nanoid();
        return dynamo
          .putItem({
            TableName: "RoamJSSmartBlocks",
            Item: {
              uuid: { S: graph },
              name: { S: graph },
              status: { S: toStatus("USER") },
              token: { S: sha256(newToken).toString() },
            },
          })
          .promise()
          .then(() => ({
            statusCode: 200,
            body: JSON.stringify({ token: newToken }),
            headers,
          }));
      } else {
        return {
          statusCode: 401,
          body: `Unauthorized to generate token for graph ${graph}`,
          headers,
        };
      }
    })
    .catch((e) => ({
      statusCode: 500,
      body: e.message,
      headers,
    }));
};
