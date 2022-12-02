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
    res.status(200).json(data);
  } catch (err) {
    console.log("handling err", err);
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
  console.log("activity", activity);

//   const twt = await pc.account.update({
//     where: {
//       providerAccountId: twtrId,
//     },
//     data: {
//       Following: {
//         connectOrCreate: {
//             where: {
//                 id: userData.id,
//             },

//           create: {
//             id: userData.id!,
//             username: userData.username!,
//             name: userData.name,
//             bio: userData.description,
//             location: userData.location,
//             url: userData.url,
//             followers: userData?.public_metrics?.followers_count!,
//             following: userData?.public_metrics?.following_count!,
//             tweets: userData?.public_metrics?.tweet_count,
//             latestLikes: activity.lastLike.time,
//             latestTweet: activity.lastTweet.time,
//           },
//         },
//       },
//     },
//   });
console.log('userData.id', userData.id)

const updt = await pc.following.update({
    where: {
        id: userData.id,
    },
    data: {
        latestLikes: activity.lastLike.time,
        latestTweet: activity.lastTweet.time,
    }
})


  console.log("username inserted", userData.username);
  return updt;
}

async function FetchTweetTime(tClient: Client, tweetId: any) {
  const tweet = await tClient.tweets.findTweetById(tweetId, {
    "tweet.fields": ["created_at"],
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

  if (data.errors) {
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

  if (data.errors) {
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
      time: lastTweetTime,
    },
    lastLike: {
      tweetId: lastLike,
      time: lastLikeTime,
    },
  };
}

export async function StoreUser(pc: PrismaClient, userData: User, twtrId: any) {
  console.log("tweets in store following users");

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
          },
        },
      },
    },
  });

  console.log("tweet inserted", userData.username);
  return twt;
}

export async function PullFollowingDbCount(twtrId: any) {
  console.log("session exists and user's list id exists");
  const prisma = new PrismaClient();

  console.log("twtrId", twtrId);

  const followcount = await prisma.account.findMany({
    where: {
      providerAccountId: twtrId,
    },
    select: {
      _count: {
        select: {
          Following: true,
        },
      },
    },
  });

  console.log("twtrId in API", twtrId);
  console.log("followcount", followcount[0]._count.Following);
  return followcount[0]._count.Following;
}

export async function FetchTrueFollowingCount(tClient: Client, twtrId: any) {
  console.log("for twtr iD: ", twtrId);
  const data = await tClient.users.findUserById(twtrId, {
    "user.fields": ["public_metrics"],
  });
  const followerCount = data.data?.public_metrics?.followers_count;
  console.log("real followers", data.data?.public_metrics?.followers_count);
  const followingCount = data.data?.public_metrics?.following_count;
  console.log("real following", data.data?.public_metrics?.following_count);
}

async function FetchFollowingDB(twtrId: any) {
  const prisma = new PrismaClient();
  const following = await prisma.account.findMany({
    where: {
      providerAccountId: twtrId,
    },
    select: {
      Following: {
        select: {
          id: true,
          name: true,
          username: true,
          bio: true,
          location: true,
          url: true,
          followers: true,
          following: true,
          tweets: true,
          latestLikes: true,
          latestTweet: true,
        },
      },
    },
  });

  return following;
}

export async function FetchFollowing(tClient: Client, twtrId: string) {
  // Make Following array to store all following users
  let numTweets = 0;

  // Count how many following users already in database
  const followcount = await PullFollowingDbCount(twtrId);

  console.log("followcount", followcount);

  // Fetch the number of following users from Twitter API
  await FetchTrueFollowingCount(tClient, twtrId);

  // If the number of following users in database is less than the number of following users from Twitter API, fetch the following users from Twitter API
  if (followcount < 1) {
    let following: User[] = [];

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
        await StoreUser(prisma, user, twtrId);
        following.push(user);
      }
      numTweets += page?.meta?.result_count || 0;
    }
    return following;
  } else {
    let following: any[] = [];
    console.log("no following in db");
    const pullDbFollowing = await FetchFollowingDB(twtrId);
    console.log("following in DB", pullDbFollowing);
    const dbFollowing = pullDbFollowing[0].Following;
    for (const user of dbFollowing ?? []) {
      console.log("user FetchFollowing username: ", user.username);
      console.log("FetchFollowing followers:", user.followers);8
      following.push(user);
    }
    return following;
  }
}

export async function FetchFollowingLatestActivity(
  tClient: Client,
  twtrId: string
) {
  let rateLimitCounter = 73;
  const following = await FetchFollowing(tClient, twtrId);
  const followingActivity: any = [];
  for (const user of following) {
    if (rateLimitCounter > 0) {
      console.log('looping to fetch user activity', user.username, user.id);
        console.log("rate limit counter", rateLimitCounter);
        let activity;
        try {
        activity = await FetchLatestActivity(tClient, user.id);
        const returnedUsrData = await StoreUserActivity(prisma, user,activity, twtrId);
        console.log("returnedUsrData", returnedUsrData);
        } catch (error) {   
            console.log("error", error);
            if (error?.status === 429) {
                console.log("rate limit exceeded");
                rateLimitCounter = 0;
            }
            if (error?.status === 400) {
                console.log("bad request");
            }
                activity = {}

        }
      followingActivity.push({
        user: user,
        activity: activity,
      });
     
      rateLimitCounter--;
    } else {
      rateLimitCounter = 73;
      console.log("[SLEEPING FOR 15 MINUTES, RATE LIMIT REACHED]");
      // Sleep for 15 minutes
      await setTimeout(900000);
    }
  }
  return followingActivity;
}
