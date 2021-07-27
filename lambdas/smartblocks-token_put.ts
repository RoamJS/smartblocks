import { APIGatewayProxyHandler } from "aws-lambda";
import AWS from "aws-sdk";
import randomstring from "randomstring";

const dynamo = new AWS.DynamoDB({
  apiVersion: "2012-08-10",
  region: "us-east-1",
});
const headers = {
  "Access-Control-Allow-Origin": "https://roamresearch.com",
  "Access-Control-Allow-Methods": "PUT",
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const { graph } = JSON.parse(event.body) as {
    graph: string;
  };
  const token = event.headers.Authorization || event.headers.authorization || '';;
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
        !r.Item ||
        (r.Item.status?.S === "USER" && r.Item.token?.S === token)
      ) {
        const newToken = randomstring.generate();
        return dynamo
          .putItem({
            TableName: "RoamJSSmartBlocks",
            Item: {
              uuid: { S: graph },
              name: { S: graph },
              status: { S: "USER" },
              token: { S: newToken },
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
