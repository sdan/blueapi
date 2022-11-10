// @ts-ignore
import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import { Client } from "twitter-api-sdk";
import { components } from "../../../../utils/twitter";
type User = components["schemas"]["User"];
const prisma = new PrismaClient();

import Cors from "cors";

// Initializing the cors middleware
// You can read more about the available options here: https://github.com/expressjs/cors#configuration-options
const cors = Cors({
  methods: ["POST", "GET", "HEAD"],
});

// Helper method to wait for a middleware to execute before continuing
// And to throw an error when an error happens in a middleware
function runMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  fn: Function
) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }

      return resolve(result);
    });
  });
}

export default async function handle(req: any, res: any) {
  // Run the middleware
  await runMiddleware(req, res, cors);

  console.log("in api fetch");
  console.log("req.body", req.body);

  const { accessToken, twtrId } = req.body;

  try {
    if (!accessToken && !twtrId) {
      throw new Error("No access token or twtrId id");
    }
    const tClient = new Client(accessToken);

    console.log("api route twitter", accessToken);

    console.log("twtrId ID", twtrId);

    const data = await FetchFollowing(tClient, twtrId);
    console.log("numTweets", data);
    res.status(200).json({ data });
  } catch (err) {
    console.log("fetch err", err);
    res.status(500).json({ error: err });
  }
}

export async function StoreUser(
  pc: PrismaClient,
  userData: User,
  twtrId: any
) {
  console.log("tweets in store list tweets");

  const twt = await pc.account.update({
    where: {
      providerAccountId: twtrId,
    },
    data: {
      Following: {
        connectOrCreate: {
          where: {
            id: userData.id,
          },
          create: {
            id: userData.id!,
            username: userData.username!,
            name: userData.name!,
            bio: userData.description!,
            location: userData.location!,
            url: userData.url!,
            followers: userData?.public_metrics?.followers_count!,
            following: userData?.public_metrics?.following_count!,
            likes: userData?.public_metrics?.tweet_count!

          },
        },
      },
    },
  });

  console.log("tweet inserted", userData.username);
  return twt;
}

export async function FetchFollowing(tClient: Client, twtrId: string) {
  let numTweets = 0;
  let insertedUser: any;

  console.log("in fetch following", twtrId);

  const getFollowing = tClient.users.usersIdFollowing(twtrId, {
    max_results: 100,
    "user.fields": [
      "id",
      "name",
      "username",
      "created_at",
      "description",
      "location",
      "profile_image_url",
      "public_metrics",
      "verified",
      "url",
      "entities",
    ],
  });

  for await (const page of getFollowing) {
    for (const user of page.data ?? []) {
      console.log("user id: ", user.id);
      console.log("followers:", user.public_metrics?.followers_count);
      insertedUser = await StoreUser(prisma, user, twtrId);
    }
    numTweets += page?.meta?.result_count || 0;
  }

  console.log("cumtweets:", numTweets);
  return numTweets;
}
