import { APIGatewayProxyHandler } from "aws-lambda";
import nanoid from "nanoid";
import format from "date-fns/format";
import {
  headers,
  dynamo,
  s3,
  fromStatus,
  toStatus,
  isInvalid,
} from "./common";

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
  const price = Number(priceArg) || 0;
  if (price >= 0) {
    return {
      statusCode: 400,
      body: `We no longer support premium SmartBlock workflows. Please remove the price block and try again`,
      headers,
    };
  }

  if (isInvalid(workflow)) {
    return {
      statusCode: 400,
      headers,
      body: "Your workflow was rejected from being published to the SmartBlocks Store, because it contains some illegal commands. Please remove these commands and try again.",
    };
  }
  if (/\n/.test(name)) {
    return {
      statusCode: 400,
      headers,
      body: "Your workflow name has invalid characters. Please remove and try again.",
    };
  }
  if (name.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: "Your workflow name is empty. Please add a name!",
    };
  }
  if (name.length > 64) {
    return {
      statusCode: 400,
      headers,
      body: `Your workflow name is ${name.length} characters long. The maximum length is 64.`,
    };
  }
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
      const existingWorkflow = r.Items.find(
        (i) => fromStatus(i.status.S) !== "USER"
      );
      if (existingWorkflow && existingWorkflow?.uuid?.S !== uuid) {
        return {
          statusCode: 400,
          body: `Workflow with name ${name} already exists in the store`,
          headers,
        };
      }
      const version = format(new Date(), "yyyy-MM-dd-hh-mm-ss");
      const putItem = (existingDisplayName: string, previousWorkflow = "") =>
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
                  name: { S: name },
                  tags: { SS: tags?.length ? tags : ["Smartblock"] },
                  img: { S: img.replace(/^!\[.*?\]\(/, "").replace(/\)$/, "") },
                  author: { S: author },
                  description: { S: description },
                  workflow: { S: version },
                  status: { S: toStatus("LIVE") },
                },
              })
              .promise()
          )
          .then(() => ({
            statusCode: 200,
            body: JSON.stringify({
              uuid,
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
          .then((r) => putItem(r.Item.description?.S, r.Item?.workflow?.S));
      } else {
        return dynamo
          .getItem({
            TableName: "RoamJSSmartBlocks",
            Key: { uuid: { S: author } },
          })
          .promise()
          .then((r) =>
            dynamo
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
