import * as functions from "firebase-functions";
import {db} from "./db";

export const subscribe = functions.https.onRequest(async (req, res) => {
  const name = req.body.name;
  const email = req.body.email;
  const referral = req.body.referral;

  const writeResult = await db.collection("subscribers").add({
    name: name,
    email: email,
    referral: referral,
  });

  res.json({result: `subscription with ID: ${writeResult.id} added`});
});
