import AWS from "aws-sdk";

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

export const toStatus = (s: string) =>
  process.env.NODE_ENV === "development" ? `${s} DEV` : s;
export const fromStatus = (s = "") => s.replace(/ DEV$/, "");

export const isInvalid = (workflow = '') =>
  /<%((J(A(VASCRIPT(ASYNC)?)?)?)|(ONBLOCKEXIT)|(IF(TRUE)?)):/.test(workflow);
