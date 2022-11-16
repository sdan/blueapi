// @ts-ignore
import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import { Client } from "twitter-api-sdk";
import { components } from "../../../../utils/twitter";
type User = components["schemas"]["User"];
const prisma = new PrismaClient();
import { setTimeout } from "timers/promises";
import Cors from "cors";
import { time } from "console";

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

  console.log("in api inactive fetch");
  console.log("req.body", req.body);

  const { accessToken, twtrId } = req.body;

  try {
    if (!accessToken && !twtrId) {
      throw new Error("No access token or twtrId id");
    }
    const tClient = new Client(accessToken);

    console.log("api route twitter", accessToken);

    console.log("twtrId ID", twtrId);

    const data = await FetchFollowingLatestActivity(tClient, twtrId);
    res.status(200).json(data );
  } catch (err) {
    console.log("fetch err", err);
    res.status(500).json({ error: err });
  }
}

export async function StoreUserActivity(
  pc: PrismaClient,
  userData: User,
  activity: any,
  twtrId: any
) {
  console.log("tweets in store updating user activity");

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
            name: userData.name,
            bio: userData.description,
            location: userData.location,
            url: userData.url,
            followers: userData?.public_metrics?.followers_count!,
            following: userData?.public_metrics?.following_count!,
            tweets: userData?.public_metrics?.tweet_count,
            latestLikes: activity.lastLike.time,
            latestTweet: activity.lastTweet.time,
          },
        },
      },
    },
  });

  console.log("username inserted", userData.username);
  return twt;
}

async function FetchTweetTime(tClient: Client, tweetId: any) {
  const tweet = await tClient.tweets.findTweetById(tweetId
    ,{
    'tweet.fields': [
      'created_at',
    ],
    });

  return tweet.data?.created_at;
}

export async function FetchLatestTweet(
  tClient: Client,
  twtrId: any
): Promise<any> {
  const data = await tClient.tweets.usersIdTweets(twtrId, {
    max_results: 5,
  });

  if(data.errors){
    console.log("[ERROR FETCH TWEET]", data.errors);
      }

  return data.meta?.newest_id;
}

export async function FetchLatestLike(
  tClient: Client,
  twtrId: any
): Promise<any> {
  const data = await tClient.tweets.usersIdLikedTweets(twtrId, {
    max_results: 5,
    });

    if(data.errors){
  console.log("[ERROR FETCH LIKES]", data.errors);
    }

  return data.data![0].id;
}

export async function FetchLatestActivity(tClient: Client, twtrId: any) {
  const lastTweet = await FetchLatestTweet(tClient, twtrId);
  const lastTweetTime = await FetchTweetTime(tClient, lastTweet);
  const lastLike = await FetchLatestLike(tClient, twtrId);
  const lastLikeTime = await FetchTweetTime(tClient, lastLike);
  console.log("lastTweet", lastTweet);
  console.log("lastLike", lastLike);
  return {
    lastTweet: {
      tweetId: lastTweet,
      time: lastTweetTime
    },  
    lastLike: {
      tweetId: lastLike, 
      time: lastLikeTime
      },
  }
}

export async function FetchFollowing(tClient: Client, twtrId: string) {
// Make Following array to store all following users
  let following: User[] = [];
  let numTweets = 0;

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
      console.log("user username: ", user.username);
      console.log("followers:", user.public_metrics?.followers_count);
      following.push(user);
    }
    numTweets += page?.meta?.result_count || 0;
  }
  return following;
}

export async function FetchFollowingLatestActivity(tClient: Client, twtrId: string){
  let rateLimitCounter = 73;
  const following = await FetchFollowing(tClient, twtrId);
  const followingActivity: any = [];
  for (const user of following) {
    if(rateLimitCounter > 0){
    const activity = await FetchLatestActivity(tClient, user.id);
    followingActivity.push({
      user: user,
      activity: activity,
    });
    StoreUserActivity(prisma, user,activity, twtrId);
    rateLimitCounter--;
  } else {
    rateLimitCounter = 73;
    console.log("[SLEEPING FOR 15 MINUTES, RATE LIMIT REACHED]");
    // Sleep for 15 minutes
    await setTimeout(900000);

  }
  return followingActivity;
}
}
