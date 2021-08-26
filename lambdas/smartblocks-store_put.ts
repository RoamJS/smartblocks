import { APIGatewayProxyHandler } from "aws-lambda";
import AWS from "aws-sdk";
import { v4 } from "uuid";
import format from "date-fns/format";

const dynamo = new AWS.DynamoDB({
  apiVersion: "2012-08-10",
  region: "us-east-1",
});
const s3 = new AWS.S3({
  apiVersion: "2006-03-01",
  region: "us-east-1",
});
const ses = new AWS.SES({ apiVersion: "2010-12-01", region: "us-east-1" });
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
    price: priceArg = "0",
  } = JSON.parse(event.body) as {
    img?: string;
    name: string;
    tags?: string[];
    author: string;
    description?: string;
    workflow: string;
    uuid?: string;
    price?: string;
  };
  const price = (Number(priceArg) || 0) * 100;
  if (price < 0) {
    return {
      statusCode: 400,
      body: `Price must be greater than or equal to 0.`,
      headers,
    };
  } else if (price > 0 && price < 100) {
    return {
      statusCode: 400,
      body: `Prices greater than 0 must be greater than $1.`,
      headers,
    };
  }
  const requiresReview =
    /<%((J(A(VASCRIPT(ASYNC)?)?)?)|(ONBLOCKEXIT)|(IF(TRUE)?)):/.test(workflow);
  const token =
    event.headers.Authorization || event.headers.authorization || "";
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
      const version = format(new Date(), "yyyy-MM-dd-hh-mm-ss");
      const putItem = () =>
        s3
          .upload({
            Bucket: "roamjs-smartblocks",
            Body: workflow,
            Key: `${uuid}/${version}.json`,
            ContentType: "application/json",
          })
          .promise()
          .then(() =>
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
                  workflow: { S: version },
                  status: { S: requiresReview ? "UNDER REVIEW" : "LIVE" },
                },
              })
              .promise()
          )
          .then(() =>
            ses
              .sendEmail({
                Destination: {
                  ToAddresses: ["support@roamjs.com"],
                },
                Message: {
                  Body: {
                    Html: {
                      Charset: "UTF-8",
                      Data: `<p>Name: ${name}</p>
<p>Description: ${description}</p>
<p>Requires Review: ${`${requiresReview}`.toUpperCase()}</p>
<p>Price: ${price || "FREE"}</p>`,
                    },
                  },
                  Subject: {
                    Charset: "UTF-8",
                    Data: `New SmartBlock ${name} Published!`,
                  },
                },
                Source: "support@roamjs.com",
              })
              .promise()
          )
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
                  headers,
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
            !r.Item?.token.S || r.Item?.token?.S !== token
              ? {
                  statusCode: 401,
                  body: `Token unauthorized for creating workflows from graph ${author}`,
                  headers,
                }
              : price > 0 && !r.Item?.stripe?.S
              ? {
                  statusCode: 401,
                  body: `Account must be connected to stripe in order to price over 0. Visit [[roam/js/smartblocks]] to connect.`,
                  headers,
                }
              : dynamo
                  .query({
                    TableName: "RoamJSSmartBlocks",
                    IndexName: "status-author-index",
                    ExpressionAttributeNames: {
                      "#s": "status",
                      "#a": "author",
                    },
                    ExpressionAttributeValues: {
                      ":s": { S: "LIVE" },
                      ":a": { S: author },
                    },
                    KeyConditionExpression: "#a = :a AND #s = :s",
                  })
                  .promise()
                  .then((qr) => {
                    const limit = Number(r.Item?.limit?.N) || 5;
                    return qr.Count >= limit
                      ? {
                          statusCode: 401,
                          body: `Not allowed to publish more than ${limit} workflows. Reach out to support@roamjs.com about increasing your limit.`,
                          headers,
                        }
                      : putItem();
                  })
          );
      }
    })
    .catch((e) => ({
      statusCode: 500,
      body: e.message,
      headers,
    }));
};
