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
  "Access-Control-Allow-Methods": "GET",
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const { uuid = "" } = event.queryStringParameters || {};
  const paymentIntentId =
    event.headers.Authorization || event.headers.authorization || "";
  return uuid
    ? dynamo
        .getItem({
          TableName: "RoamJSSmartBlocks",
          Key: { uuid: { S: uuid } },
        })
        .promise()
        .then((r) =>
          r.Item?.status?.S !== "LIVE"
            ? {
                statusCode: 400,
                body: `Invalid id ${uuid} doesn't represent a LIVE SmartBlock Workflow`,
              }
            : (Number(r.Item?.price?.N) || 0) <= 0
            ? {
                statusCode: 200,
                body: JSON.stringify({ workflow: r.Item.workflow.S }),
                headers,
              }
            : !!paymentIntentId
            ? stripe.paymentIntents.retrieve(paymentIntentId).then((p) =>
                p.status === "succeeded"
                  ? {
                      statusCode: 200,
                      body: JSON.stringify({ workflow: r.Item.workflow.S }),
                      headers,
                    }
                  : {
                      statusCode: 401,
                      body: `Invalid payment id`,
                      headers,
                    }
              )
            : dynamo
                .getItem({
                  TableName: "RoamJSSmartBlocks",
                  Key: { uuid: { S: r.Item.author.S } },
                })
                .promise()
                .then((t) =>
                  stripe.paymentIntents.create({
                    payment_method_types: ["card"],
                    amount: Number(r.Item?.price?.N),
                    currency: "usd",
                    application_fee_amount:
                      30 + Math.ceil(Number(r.Item?.price?.N) * 0.08),
                    transfer_data: {
                      destination: t.Item.stripe.S,
                    },
                  })
                )
                .then((s) => ({
                  statusCode: 200,
                  body: JSON.stringify({ secret: s.client_secret }),
                  headers,
                }))
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
