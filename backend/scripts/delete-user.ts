// Deletes a dev account and everything it owns, so the email can register
// again:
//   npm run dev:delete-user -- someone@example.com
//
// Removes the user's DynamoDB items (pets, vaccinations), their photos in S3
// and the Cognito user. Uses your local AWS credentials. Dev only.

import {
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
  ListUserPoolsCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

const ENV = process.env.PAWPERS_ENV ?? 'dev';
const REGION = 'eu-west-2';
const PREFIX = `pawpers-${ENV}`;
const email = process.argv[2]?.trim().toLowerCase();

if (ENV !== 'dev') {
  console.error(`Refusing to run against "${ENV}": this script only deletes dev accounts.`);
  process.exit(1);
}
if (!email) {
  console.error('Usage: npm run dev:delete-user -- someone@example.com');
  process.exit(1);
}

const cognito = new CognitoIdentityProviderClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const s3 = new S3Client({ region: REGION });

async function main() {
  const pools = await cognito.send(new ListUserPoolsCommand({ MaxResults: 60 }));
  const poolId = pools.UserPools?.find((p) => p.Name === PREFIX)?.Id;
  if (!poolId) throw new Error(`User pool ${PREFIX} not found`);

  const { Users } = await cognito.send(
    new ListUsersCommand({ UserPoolId: poolId, Filter: `email = "${email!.replace(/"/g, '')}"` }),
  );
  const user = Users?.[0];
  if (!user?.Username) {
    console.log(`No ${ENV} account for ${email}. Nothing to delete.`);
    return;
  }
  const sub = user.Attributes?.find((a) => a.Name === 'sub')?.Value;
  if (!sub) throw new Error('User has no sub attribute');

  // Data: every item in the user's partition.
  const table = PREFIX;
  const keys: { PK: string; SK: string }[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await ddb.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': `USER#${sub}` },
        ProjectionExpression: 'PK, SK',
        ExclusiveStartKey,
      }),
    );
    keys.push(...((page.Items ?? []) as { PK: string; SK: string }[]));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  for (let i = 0; i < keys.length; i += 25) {
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: { [table]: keys.slice(i, i + 25).map((Key) => ({ DeleteRequest: { Key } })) },
      }),
    );
  }

  // Photos: everything under users/<sub>/.
  const { Account } = await new STSClient({ region: REGION }).send(new GetCallerIdentityCommand({}));
  const Bucket = `${PREFIX}-photos-${Account}`;
  let photos = 0;
  let ContinuationToken: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: `users/${sub}/`, ContinuationToken }));
    const objects = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
    if (objects.length) {
      await s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: objects, Quiet: true } }));
      photos += objects.length;
    }
    ContinuationToken = page.NextContinuationToken;
  } while (ContinuationToken);

  await cognito.send(new AdminDeleteUserCommand({ UserPoolId: poolId, Username: user.Username }));

  console.log(
    `Deleted ${email} from ${ENV}: ${keys.length} record(s), ${photos} photo(s), and the account. ` +
      'The email can register again.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
