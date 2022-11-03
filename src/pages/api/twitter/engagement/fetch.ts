import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client'
import { components } from 'twitter-api-sdk/dist/types';
import Client from 'twitter-api-sdk';
type Tweet = {
    /** @description Specifies the type of attachments (if any) present in this Tweet. */
    attachments?: {
        /** @description A list of Media Keys for each one of the media attachments (if media are attached). */
        media_keys?: components["schemas"]["MediaKey"][];
        /** @description A list of poll IDs (if polls are attached). */
        poll_ids?: components["schemas"]["PollId"][];
    };
    author_id?: components["schemas"]["UserId"];
    context_annotations?: components["schemas"]["ContextAnnotation"][];
    conversation_id?: components["schemas"]["TweetId"];
    /**
     * Format: date-time
     * @description Creation time of the Tweet.
     * @example 2021-01-06T18:40:40.000Z
     */
    created_at?: string;
    entities?: components["schemas"]["FullTextEntities"];
    /** @description The location tagged on the Tweet, if the user provided one. */
    geo?: {
        coordinates?: components["schemas"]["Point"];
        place_id?: components["schemas"]["PlaceId"];
    };
    id: components["schemas"]["TweetId"];
    in_reply_to_user_id?: components["schemas"]["UserId"];
    /**
     * @description Language of the Tweet, if detected by Twitter. Returned as a BCP47 language tag.
     * @example en
     */
    lang?: string;
    /** @description Nonpublic engagement metrics for the Tweet at the time of the request. */
    non_public_metrics?: {
        /**
         * Format: int32
         * @description Number of times this Tweet has been viewed.
         */
        impression_count?: number;
    };
    /** @description Organic nonpublic engagement metrics for the Tweet at the time of the request. */
    organic_metrics?: {
        /** @description Number of times this Tweet has been viewed. */
        impression_count: number;
        /** @description Number of times this Tweet has been liked. */
        like_count: number;
        /** @description Number of times this Tweet has been replied to. */
        reply_count: number;
        /** @description Number of times this Tweet has been Retweeted. */
        retweet_count: number;
    };
    /**
     * @description Indicates if this Tweet contains URLs marked as sensitive, for example content suitable for mature audiences.
     * @example false
     */
    possibly_sensitive?: boolean;
    /** @description Promoted nonpublic engagement metrics for the Tweet at the time of the request. */
    promoted_metrics?: {
        /**
         * Format: int32
         * @description Number of times this Tweet has been viewed.
         */
        impression_count?: number;
        /**
         * Format: int32
         * @description Number of times this Tweet has been liked.
         */
        like_count?: number;
        /**
         * Format: int32
         * @description Number of times this Tweet has been replied to.
         */
        reply_count?: number;
        /**
         * Format: int32
         * @description Number of times this Tweet has been Retweeted.
         */
        retweet_count?: number;
    };
    /** @description Engagement metrics for the Tweet at the time of the request. */
    public_metrics?: {
        /** @description Number of times this Tweet has been liked. */
        like_count: number;
        /** @description Number of times this Tweet has been quoted. */
        quote_count?: number;
        /** @description Number of times this Tweet has been replied to. */
        reply_count: number;
        /** @description Number of times this Tweet has been Retweeted. */
        retweet_count: number;
    };
    /** @description A list of Tweets this Tweet refers to. For example, if the parent Tweet is a Retweet, a Quoted Tweet or a Reply, it will include the related Tweet referenced to by its parent. */
    referenced_tweets?: {
        id: components["schemas"]["TweetId"];
        /** @enum {string} */
        type: "retweeted" | "quoted" | "replied_to";
    }[];
    reply_settings?: components["schemas"]["ReplySettings"];
    /** @description The name of the app the user Tweeted from. */
    source?: string;
    text: components["schemas"]["TweetText"];
    withheld?: components["schemas"]["TweetWithheld"];
};


export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('in api liked fetch');
  console.log('req.body', req.body);
  const { accessToken, twtrId } = req.body;
  try {
    console.log('accessToken', accessToken);

    const tClient = new Client(accessToken!);

    console.log('api route twitter', accessToken);

    console.log('twtr ID', twtrId);

    const data = await FetchLikes(tClient, twtrId);
    console.log('numTweets', data);
    res.status(200).json({ data });
  } catch (err) {
    console.log('fetch err', err);
    res.status(500).json({ error: err });
  }
}

export async function StoreLikedTweets(
  pc: PrismaClient,
  tweetData: Tweet,
  username: string,
  providerAccountId: any
) {
  console.log('tweets in storetweets');

  const twt = await pc.account.update({
    where: {
      providerAccountId: providerAccountId,
    },
    data: {
      LikedTweets: {
        connectOrCreate: {
          where: {
            id: tweetData.id,
          },
          create: {
            id: tweetData.id,
            username: username,
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

  console.log('liked tweet inserted', tweetData.id);
  return twt;
}

export async function UserIdToUsername(tClient: Client, twtrId: string) {
  const user = await tClient.users.findUserById(twtrId);
  return user.data?.username;
}

// Fetches all likes from a specific user from Twitter API
export async function FetchLikes(tClient: Client, twtrId: string) {
  const prisma = new PrismaClient();
  let numTweets = 0;
  console.log('fetching likes');

  // Fetch all likes from Twitter API
  const likes = tClient.tweets.usersIdLikedTweets(twtrId, {
    max_results: 100,
    'tweet.fields': [
      'author_id',
      'geo',
      'public_metrics',
      'created_at',
      'entities',
    ],
  });
  console.log('likes', likes);

  // Store all likes in database
  for await (const page of likes) {
    for (const tweet of page.data ?? []) {
      console.log('page user ', page.includes?.users);
      console.log('liked tweet: ', tweet);
      const username =
        (await UserIdToUsername(tClient, tweet.author_id!)) || '';

      await StoreLikedTweets(prisma, tweet, username, twtrId);
    }
    numTweets += page.data?.length ?? 0;
  }
  console.log('numTweets', numTweets);
  return numTweets;
}
