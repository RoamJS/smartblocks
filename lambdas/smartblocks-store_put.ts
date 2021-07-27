import { APIGatewayProxyHandler } from "aws-lambda";
import AWS from "aws-sdk";
import { v4 } from "uuid";

const dynamo = new AWS.DynamoDB({
  apiVersion: "2012-08-10",
  region: "us-east-1",
});
const headers = {
  "Access-Control-Allow-Origin": "https://roamresearch.com",
  "Access-Control-Allow-Methods": "PUT",
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const {
    name,
    tags = [],
    img = "",
    author,
    description = "",
    workflow,
    uuid = v4(),
  } = JSON.parse(event.body) as {
    img: string;
    name: string;
    tags: string[];
    author: string;
    description: string;
    workflow: string;
    uuid: string;
  };
  const price = 0;
  const requiresReview = /<%((J(A(VASCRIPT(ASYNC)?)?)?)|(ONBLOCKEXIT)|(IF(TRUE)?)):/.test(
    workflow
  );
  const token = event.headers.Authorization || event.headers.authorization || '';
  return dynamo
    .query({
      TableName: "RoamJSSmartBlocks",
      IndexName: "name-index",
      ExpressionAttributeNames: {
        "#n": "name",
      },
      ExpressionAttributeValues: {
        ":n": { S: name },
      },
      KeyConditionExpression: "#n = :n",
    })
    .promise()
    .then((r) => {
      const existingWorkflow = r.Items.find((i) => i.status.S !== "USER");
      if (existingWorkflow && existingWorkflow?.uuid?.S !== uuid) {
        return {
          statusCode: 400,
          body: `Workflow with name ${name} already exists in the store`,
          headers,
        };
      }
      const putItem = () =>
        dynamo
          .putItem({
            TableName: "RoamJSSmartBlocks",
            Item: {
              uuid: { S: uuid },
              price: { N: `${price}` },
              name: { S: name },
              tags: { SS: tags?.length ? tags : ["Smartblock"] },
              img: { S: img.replace(/^!\[.*?\]\(/, "").replace(/\)$/, "") },
              author: { S: author },
              description: { S: description },
              workflow: { S: workflow },
              status: { S: requiresReview ? "UNDER REVIEW" : "LIVE" },
            },
          })
          .promise()
          .then(() => ({
            statusCode: 200,
            body: JSON.stringify({
              uuid,
              requiresReview,
            }),
            headers,
          }));
      if (existingWorkflow) {
        return dynamo
          .getItem({
            TableName: "RoamJSSmartBlocks",
            Key: { uuid: { S: existingWorkflow.author.S } },
          })
          .promise()
          .then((r) =>
            r.Item?.token?.S && r.Item?.token?.S === token
              ? putItem()
              : {
                  statusCode: 401,
                  body: `Token unauthorized for updating workflow ${existingWorkflow.name.S}`,
                }
          );
      } else {
        return dynamo
          .getItem({
            TableName: "RoamJSSmartBlocks",
            Key: { uuid: { S: author } },
          })
          .promise()
          .then((r) =>
            r.Item?.token && r.Item?.token === token
              ? putItem()
              : {
                  statusCode: 401,
                  body: `Token unauthorized for creating workflows from graph ${author}`,
                }
          );
      }
    })
    .catch((e) => ({
      statusCode: 500,
      body: e.message,
      headers,
    }));
};
