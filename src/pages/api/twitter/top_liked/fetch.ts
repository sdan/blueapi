import { PrismaClient } from '@prisma/client';
import { Client } from 'twitter-api-sdk';
import { components } from 'twitter-api-sdk/dist/types';
type Tweet = components['schemas']['Tweet'];
const prisma = new PrismaClient();

export default async function handle(req: any, res: any) {
  console.log('in api fetch');
  console.log('req.body', req.body);
  const { accessToken, twtrId } = req.body;

  try {
    if (!accessToken && !twtrId) {
      throw new Error('No access token or twitter id');
    }
    const tClient = new Client(accessToken);

    console.log('api route twitter', accessToken);

    console.log('twtr ID', twtrId);

    const data = await FetchTweets(tClient, twtrId);
    console.log('numTweets', data);
    res.status(200).json({ data });
  } catch (err) {
    console.log('fetch err', err);
    res.status(500).json({ error: err });
  }
}

export async function StoreTweet(
    pc: PrismaClient,
    tweetData: Tweet,
    providerAccountId: any
  ) {
    console.log('tweets in storetweets');
  
    const twt = await pc.account.update({
      where: {
        providerAccountId: providerAccountId,
      },
      data: {
        TimelineTweets: {
          connectOrCreate: {
            where: {
              id: tweetData.id,
            },
            create: {
              id: tweetData.id,
              author: tweetData.author_id!,
              text: tweetData.text,
              likes: tweetData.public_metrics?.like_count,
              retweets: tweetData.public_metrics?.retweet_count,
              entities: tweetData.entities,
              createdAt: tweetData.created_at!,
            },
          },
        },
      },
    });
  
    console.log('tweet inserted', tweetData.id);
    return twt;
  }
  

export async function FetchTweets(tClient: Client, twtrId: string) {
  let numTweets = 0;
  let insertedTweet: any;
  let twt: Tweet;

  console.log('in fetch tweets', twtrId);

  const getUsersTimeline = tClient.tweets.usersIdTimeline(twtrId, {
    max_results: 100,
    start_time: new Date(Date.now() - 86400000).toISOString(),
    'tweet.fields': [
      'author_id',
      'geo',
      'public_metrics',
      'created_at',
      'entities',
    ],
  });

  for await (const page of getUsersTimeline) {
    for (twt of page.data ?? []) {
      console.log('tweet id: ', twt.id);
      // console.log('author: ', twt.author_id);
      // console.log('id: ', twt.id);
      console.log('likes:', twt.public_metrics?.like_count);
      // console.log('retweets:', twt.public_metrics?.retweet_count);
      // console.log('time: ', twt.created_at);
      // console.log('entities: ', twt.entities);
      insertedTweet = await StoreTweet(prisma, twt, twtrId);
    }
    numTweets += page?.meta?.result_count || 0;
  }

  console.log('cumtweets:', numTweets);
  return numTweets;
}
