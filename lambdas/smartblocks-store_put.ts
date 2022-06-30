import { APIGatewayProxyHandler } from "aws-lambda";
import nanoid from "nanoid";
import format from "date-fns/format";
import { headers, dynamo, s3, ses, validToken, fromStatus, toStatus } from "./common";

export const handler: APIGatewayProxyHandler = async (event) => {
  const {
    name,
    tags = [],
    img = "",
    author,
    description = "",
    workflow,
    uuid = nanoid(),
    price: priceArg = "0",
    displayName = "",
  } = JSON.parse(event.body) as {
    img?: string;
    name: string;
    tags?: string[];
    author: string;
    description?: string;
    workflow: string;
    uuid?: string;
    price?: string;
    displayName?: string;
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
      const existingWorkflow = r.Items.find((i) => fromStatus(i.status.S) !== "USER");
      if (existingWorkflow && existingWorkflow?.uuid?.S !== uuid) {
        return {
          statusCode: 400,
          body: `Workflow with name ${name} already exists in the store`,
          headers,
        };
      }
      const version = format(new Date(), "yyyy-MM-dd-hh-mm-ss");
      const putItem = (existingDisplayName: string, previousWorkflow = '') =>
        s3
          .upload({
            Bucket: "roamjs-smartblocks",
            Body: workflow,
            Key: `${uuid}/${version}.json`,
            ContentType: "application/json",
          })
          .promise()
          .then(() =>
            displayName && displayName !== existingDisplayName
              ? dynamo
                  .updateItem({
                    TableName: "RoamJSSmartBlocks",
                    Key: {
                      uuid: { S: author },
                    },
                    UpdateExpression: "SET #d = :d",
                    ExpressionAttributeNames: {
                      "#d": "description",
                    },
                    ExpressionAttributeValues: {
                      ":d": { S: displayName },
                    },
                  })
                  .promise()
                  .then(() => Promise.resolve())
              : Promise.resolve()
          )
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
                  workflow: { S: requiresReview ? previousWorkflow : version },
                  status: { S: toStatus(requiresReview ? "UNDER REVIEW" : "LIVE") },
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
            validToken(event, r.Item)
              ? putItem(r.Item.description?.S, r.Item?.workflow?.S)
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
            !validToken(event, r.Item)
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
                      ":s": { S: toStatus("LIVE") },
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
                      : putItem(r.Item?.description?.S);
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
