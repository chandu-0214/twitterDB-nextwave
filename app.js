const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "twitterClone.db");

const app = express();
app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const convertUserTableDbObjectToResponseObject = (dbObject) => {
  return {
    userId: dbObject.user_id,
    name: dbObject.name,
    userName: dbObject.username,
    password: dbObject.password,
    gender: dbObject.gender,
  };
};

const convertFollowerTableDbObjectToResponseObject = (dbObject) => {
  return {
    followerId: dbObject.follower_id,
    followerUserId: dbObject.follower_user_id,
    followingUserId: dbObject.following_user_id,
  };
};

const convertTweetTableDbObjectToResponseObject = (dbObject) => {
  return {
    tweetId: dbObject.tweet_id,
    tweet: dbObject.tweet,
    userId: dbObject.user_id,
    dateTime: dbObject.date_time,
  };
};

const convertReplyTableDbObjectToResponseObject = (dbObject) => {
  return {
    replyId: dbObject.reply_id,
    tweetId: dbObject.tweet_id,
    reply: dbObject.reply,
    userId: dbObject.user_id,
    dateTime: dbObject.date_time,
  };
};

const convertLikeTableDbObjectToResponseObject = (dbObject) => {
  return {
    likeId: dbObject.like_id,
    tweetId: dbObject.tweet_id,
    userId: dbObject.user_id,
    dateTime: dbObject.date_time,
  };
};

const validatePassword = (password) => {
  return password.length > 5;
};

//API-1

app.post("/register/", async (request, response) => {
  const { name, username, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username='${username}';`;
  const databaseUser = await database.get(selectUserQuery);

  if (databaseUser === undefined) {
    const createUserQuery = `
      INSERT INTO
      user(name, username, password, gender)
      VALUES(
          '${name}',
          '${username}',
          '${hashedPassword}',
          '${gender}'
      );`;
    if (validatePassword(password)) {
      await database.run(createUserQuery);
      response.status(200);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API-2

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
}

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username='${username}';`;
  const databaseUser = await database.get(selectUserQuery);
  //console.log("string");
  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );

    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };

      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//console.log(payload);
//API-3

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let { username } = request;
  //const { user } = request.params;

  const getTweetsQuery = `SELECT name, tweet, date_time from user NATURAL JOIN tweet WHERE user_id IN (SELECT follower_user_id FROM follower INNER JOIN user ON user.user_id=follower.following_user_id WHERE user.username ='${username}') LIMIT 4;`;
  const tweetArray = await database.all(getTweetsQuery);
  response.send(
    tweetArray.map((eachTweet) =>
      convertTweetTableDbObjectToResponseObject(eachTweet)
    )
  );
});

//API-4

app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  //const { following } = request.params;
  //console.log("string");
  const userIdQuery = `SELECT user_id from user where username= '${username}';`;
  const { user_id } = await database.get(userIdQuery);
  console.log(user_id, "user id");
  const getUserFollowQuery = `
    SELECT name from user  WHERE user_id IN (SELECT follower_user_id FROM follower INNER JOIN user ON user.user_id=follower.following_user_id WHERE user.user_id=${user_id});`;
  const follower = await database.all(getUserFollowQuery);
  response.send(convertUserTableDbObjectToResponseObject(follower));
});

//API-5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { followers } = request.params;
  let { username } = request;
  const getUserNameQuery = `
    SELECT name from user WHERE user_id IN (SELECT following_user_id FROM follower INNER JOIN user ON user.user_id=follower.follower_user_id  WHERE user.username=${username});`;
  const name = await database.all(getUserNameQuery);
  response.send(convertFollowerTableDbObjectToResponseObject(followerName));
});

//API-6

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  let { username } = request;

  const getTweetQuery = `
     SELECT tweet, (SELECT count(tweet_id) FROM like WHERE tweet_id =${tweetId}) as likes, (SELECT count(tweet_id) from reply WHERE tweet_id=${tweetId} ) as reply, date_time from tweet WHERE tweet_id =${tweetId} IN (SELECT tweet_id FROM tweet WHERE user_id IN (SELECT following_user_id FROM follower INNER JOIN user ON user.user_id=follower.follower_user_id  WHERE user.username=${username}));`;
  const tweet = await database.all(getTweetQuery);
  if (tweet === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.send(convertTweetTableDbObjectToResponseObject(tweet));
  }
});

//API-7

app.get(
  "/tweets/:tweetId/likes/",

  authenticateToken,

  async (request, response) => {
    const { likeId } = request.params;
    let { username } = request;
    const getTweetQuery = `
     SELECT username from user WHERE user_id IN (SELECT user_id FROM like WHERE tweet_id = ${tweetId} IN (SELECT tweet_id FROM tweet WHERE user_id IN (SELECT following_user_id FROM follower INNER JOIN user ON user.user_id=follower.follower_user_id  WHERE user.username=${username})));`;
    const tweet = await database.all(getTweetQuery);
    if (tweet === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send(convertUserTableDbObjectToResponseObject(tweet));
    }
  }
);

//API-8

app.get(
  "/tweets/:tweetId/replies/",

  authenticateToken,

  async (request, response) => {
    const { replyId } = request.params;
    let { username } = request;

    const getTweetQuery = `
     SELECT user.name, reply.reply from reply INNER JOIN user ON reply.user_id = user.user_id WHERE tweet_id = ${tweetId} IN (SELECT tweet_id FROM tweet WHERE user_id IN (SELECT following_user_id FROM follower INNER JOIN user ON user.user_id=follower.follower_user_id  WHERE user.username=${username}));`;
    const tweet = await database.all(getTweetQuery);
    if (tweet === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send(convertUserTableDbObjectToResponseObject(tweet));
    }
  }
);

//API-9

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  let { username } = request;
  const userIdQuery = `SELECT * from user WHERE username=${username}`;
  const userId = await database.get(userIdQuery);

  const getTweetsQuery = `

    SELECT

      *

    FROM

     tweet

    WHERE

      tweet_id = ${tweetId};`;

  const tweets = await database.get(getTweetsQuery);

  response.send(convertTweetTableDbObjectToResponseObject(tweets));
});

//API-10

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweetId, tweet, userId, dateTime } = request.body;
  let { username } = request;
  const postTweetQuery = `

  INSERT INTO

    district (tweet_id, tweet, user_id, date_time)

  VALUES

    (${tweetId}, '${tweet}', ${userId}, ${dateTime});`;

  await database.run(postTweetQuery);

  response.send("Created a Tweet");
});

//API-11

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;
    const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id = ${tweetId};`;
    const userTweet = await database.get(deleteTweetQuery);
    if (userTweet === undefined) {
      response.status(401);
      response.send("Invalid Request");
    }
    await database.run(deleteTweetQuery);
    response.send("Tweet Removed");
  }
);

module.exports = app;
