import { APIGatewayProxyHandler } from "aws-lambda";
import { dynamo, headers, toStatus } from "./common";
import { v4 } from "uuid";

export const handler: APIGatewayProxyHandler = async (event) => {
  const { uuid = v4(), newDate } = JSON.parse(event.body) as {
    uuid?: string;
    newDate: string;
  };
  return dynamo
    .getItem({
      TableName: "RoamJSSmartBlocks",
      Key: {
        uuid: {
          S: uuid,
        },
      },
    })
    .promise()
    .then((r) => {
      const oldDate = r.Item?.name?.S;
      return dynamo
        .putItem({
          TableName: "RoamJSSmartBlocks",
          Item: {
            uuid: { S: uuid },
            name: { S: newDate },
            status: { S: toStatus("DAILY") },
          },
        })
        .promise()
        .then(() => ({
          statusCode: 200,
          body: JSON.stringify({ oldDate, uuid }),
          headers,
        }));
    })
    .catch((e) => ({
      statusCode: 500,
      body: e.message,
      headers,
    }));
};
