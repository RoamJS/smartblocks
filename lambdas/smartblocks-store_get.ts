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

export const handler: APIGatewayProxyHandler = async () => {
  return dynamo
    .scan({ TableName: "RoamJSSmartBlocks" })
    .promise()
    .then((r) => ({
      statusCode: 200,
      body: JSON.stringify({
        smartblocks: r.Items.map((i) =>
          Object.fromEntries(
            Object.entries(i).map(([k, v]) => [
              k,
              v.N ? Number(v.N) : v.S || v.SS,
            ])
          )
        ),
      }),
      headers,
    }))
    .catch((e) => ({
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: e.message
      }),
      headers,
    }));
};
