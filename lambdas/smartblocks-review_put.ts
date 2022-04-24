import { APIGatewayProxyHandler } from "aws-lambda";
import {
  dynamo,
  fromStatus,
  headers,
  s3,
  toStatus,
  validToken,
} from "./common";

const REVIEWERS = ["dvargas92495"];

export const handler: APIGatewayProxyHandler = async (event) => {
  const {
    graph = "",
    uuid = "",
    version = "",
  } = JSON.parse(event.body || "{}");
  if (!uuid) {
    return {
      statusCode: 400,
      body: "uuid is required",
      headers,
    };
  }
  return dynamo
    .getItem({
      TableName: "RoamJSSmartBlocks",
      Key: { uuid: { S: graph } },
    })
    .promise()
    .then((r) =>
      fromStatus(r.Item?.status?.S) !== "USER"
        ? {
            statusCode: 400,
            body: `Invalid id ${graph} doesn't represent a User`,
            headers,
          }
        : !validToken(event, r.Item)
        ? {
            statusCode: 401,
            body: `Invalid token with user`,
          }
        : !REVIEWERS.includes(graph)
        ? {
            statusCode: 401,
            body: `Only valid reviewers can approve`,
          }
        : s3
            .listObjectsV2({
              Bucket: "roamjs-smartblocks",
              Prefix: `${uuid}/`,
              Delimiter: "/",
            })
            .promise()
            .then((o) =>
              o.Contents.reverse()[0]
                .Key.replace(new RegExp(`^${uuid}/`), "")
                .replace(/\.json$/, "")
            )
            .then((workflow) =>
              workflow !== version
                ? {
                    statusCode: 409,
                    body: "New version was uploaded, review again.",
                    headers,
                  }
                : dynamo
                    .updateItem({
                      TableName: "RoamJSSmartBlocks",
                      Key: {
                        uuid: { S: uuid },
                      },
                      UpdateExpression: "SET #s = :s, #w = :w",
                      ExpressionAttributeNames: {
                        "#s": "status",
                        "#w": "workflow",
                      },
                      ExpressionAttributeValues: {
                        ":s": { S: toStatus("LIVE") },
                        ":w": { S: version },
                      },
                    })
                    .promise()
                    .then(() => ({
                      statusCode: 200,
                      body: JSON.stringify({
                        success: true,
                      }),
                      headers,
                    }))
            )
    )
    .catch((e) => ({
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: e.message,
      }),
      headers,
    }));
};
