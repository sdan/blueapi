# bluesearch api

this api powers bluesearch.xyz

long running operations (pulling all your follower/following stats) takes much longer than the alloted 60 seconds vercel serverless functions give you, this backend runs on a dedicated box that fetches data and stores it into a big "data lake" which can be used to fetch [public metrics](https://bluesearch.xyz/metrics) and timeline summarization
