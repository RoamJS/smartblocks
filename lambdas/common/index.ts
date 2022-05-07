import { APIGatewayProxyEvent } from "aws-lambda";
import AWS, { DynamoDB } from "aws-sdk";
import Stripe from "stripe";
import sha256 from "crypto-js/sha256";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  // @ts-ignore
  apiVersion: "2020-08-27;link_beta=v1",
  maxNetworkRetries: 3,
});
export const dynamo = new AWS.DynamoDB({
  apiVersion: "2012-08-10",
  region: "us-east-1",
});
export const s3 = new AWS.S3({
  apiVersion: "2006-03-01",
  region: "us-east-1",
});
export const headers = {
  "Access-Control-Allow-Origin": "https://roamresearch.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
};
export const ses = new AWS.SES({
  apiVersion: "2010-12-01",
  region: "us-east-1",
});

export const validToken = (
  event: APIGatewayProxyEvent,
  item: DynamoDB.AttributeMap
) => {
  const storedToken = item?.token?.S;
  if (!storedToken) return true;
  const clientToken =
    event.headers.Authorization || event.headers.authorization || "";
  return sha256(clientToken).toString() === storedToken;
};

export const toStatus = (s: string) =>
  process.env.NODE_ENV === "development" ? `${s} DEV` : s;
export const fromStatus = (s = "") => s.replace(/ DEV$/, "");
