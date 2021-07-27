import { APIGatewayProxyHandler } from "aws-lambda";
import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB({
  apiVersion: "2012-08-10",
  region: "us-east-1",
});
const headers = {
  "Access-Control-Allow-Origin": "https://roamresearch.com",
  "Access-Control-Allow-Methods": "GET",
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const { uuid = "" } = event.queryStringParameters || {};
  return uuid
    ? dynamo
        .getItem({
          TableName: "RoamJSSmartBlocks",
          Key: { uuid: { S: uuid } },
        })
        .promise()
        .then((r) =>
          r.Item?.status?.S === "LIVE"
            ? {
                statusCode: 200,
                body: JSON.stringify({ workflow: r.Item.workflow.S }),
                headers,
              }
            : {
                statusCode: 400,
                body: `Invalid id ${uuid} doesn't represent a LIVE SmartBlock Workflow`,
              }
        )
        .catch((e) => ({
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            message: e.message,
          }),
          headers,
        }))
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
        .then((r) => ({
          statusCode: 200,
          body: JSON.stringify({
            smartblocks: r.Items.map((i) =>
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
