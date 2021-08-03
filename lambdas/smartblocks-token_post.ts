import { APIGatewayProxyHandler } from "aws-lambda";
import AWS from "aws-sdk";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2020-08-27",
  maxNetworkRetries: 3,
});
const dynamo = new AWS.DynamoDB({
  apiVersion: "2012-08-10",
  region: "us-east-1",
});
const headers = {
  "Access-Control-Allow-Origin": "https://roamresearch.com",
  "Access-Control-Allow-Methods": "PUT",
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const { operation, author } = JSON.parse(event.body);
  if (!author) {
    return {
      statusCode: 400,
      body: "`author` is a required parameter.",
      headers,
    }
  }
  const token =
    event.headers.Authorization || event.headers.authorization || "";
  return dynamo
    .getItem({
      TableName: "RoamJSSmartBlocks",
      Key: { uuid: { S: author } },
    })
    .promise()
    .then((r) =>
      r.Item?.token?.S && r.Item?.token?.S !== token
        ? {
            statusCode: 401,
            body: `Token unauthorized for connecting account`,
            headers,
          }
        : operation === "CREATE"
        ? r.Item?.stripe?.S
          ? {
              statusCode: 401,
              body: `Cannot connect new Stripe account when one is already in progress`,
              headers,
            }
          : stripe.accounts
              .create({
                type: "express",
              })
              .then((a) =>
                stripe.accountLinks
                  .create({
                    account: a.id,
                    refresh_url: `${process.env.ROAMJS_HOST}/oauth?close=true`,
                    return_url: `${process.env.ROAMJS_HOST}/oauth?close=true`,
                    type: "account_onboarding",
                  })
                  .then((l) =>
                    dynamo
                      .updateItem({
                        TableName: "RoamJSSmartBlocks",
                        Key: {
                          uuid: { S: author },
                        },
                        UpdateExpression: "SET #s = :s",
                        ExpressionAttributeNames: {
                          "#s": "stripe",
                        },
                        ExpressionAttributeValues: {
                          ":s": { S: a.id },
                        },
                      })
                      .promise()
                      .then(() => l)
                  )
              )
              .then((l) => ({
                statusCode: 200,
                body: JSON.stringify({ url: l.url }),
                headers,
              }))
        : operation === "FINISH"
        ? r.Item.stripe?.S
          ? stripe.accounts
              .retrieve(r.Item.stripe?.S)
              .then((a) => ({
                statusCode: 200,
                body: JSON.stringify({ done: a.details_submitted }),
                headers,
              }))
              .catch((e) => {
                console.error(e);
                return {
                  statusCode: 200,
                  body: JSON.stringify({ done: false }),
                  headers,
                };
              })
          : {
              statusCode: 400,
              body: `No Stripe Account in progress`,
              headers,
            }
        : {
            statusCode: 400,
            body: `Invalid Operation ${operation}`,
            headers,
          }
    )
    .catch((e) => ({
      statusCode: 500,
      body: e.message,
      headers,
    }));
};
