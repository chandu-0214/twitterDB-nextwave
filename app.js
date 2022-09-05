const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3001, () => {
      console.log("Server Running at http://localhost:3001/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  console.log(authHeader);
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "secretKey", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        console.log(payload, "payload");
        next();
      }
    });
  }
};

// Register the user
app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `
    SELECT 
      * 
    FROM 
      user 
    WHERE 
      username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    }
    const createUserQuery = `
     INSERT INTO
      user (username, name, password, gender)
     VALUES
      (
       '${username}',
       '${name}',
       '${hashedPassword}',
       '${gender}'  
      );`;
    await db.run(createUserQuery);
    response.send("User created successfully");
  } else {
    response.send("User already exists");
    response.status(400);
  }
});

// Login
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  console.log(password);
  const selectUserQuery = `
    SELECT
      *
    FROM
      user
    WHERE 
      username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "secretKey");
      response.send({ "JWT Token": jwtToken });
      response.send("Login Success!");
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get(
  "/user/tweets/feed/",
  authenticationToken,
  async (request, response) => {
    response.send([
      {
        username: "SrBachchan",
        tweet: "T 3859 - do something wonderful, people may imitate it ..",
        dateTime: "2021-04-07 14:50:19",
      },
    ]);
  }
);
module.exports = app;
