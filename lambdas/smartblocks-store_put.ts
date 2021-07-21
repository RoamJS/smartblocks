import { APIGatewayProxyHandler } from "aws-lambda";
import AWS from "aws-sdk";
import { v4 } from "uuid";

const dynamo = new AWS.DynamoDB({
  apiVersion: "2012-08-10",
  region: "us-east-1",
});
const headers = {
  "Access-Control-Allow-Origin": "https://roamresearch.com",
  "Access-Control-Allow-Methods": "GET",
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
  const requiresReview = /<%((J(A(VASCRIPT(ASYNC)?)?)?)|(ONBLOCKEXIT)):/.test(workflow);
  return dynamo
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
    }))
    .catch((e) => ({
      statusCode: 500,
      body: e.message,
      headers,
    }));
};
