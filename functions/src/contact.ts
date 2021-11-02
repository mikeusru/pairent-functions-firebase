import * as functions from "firebase-functions";
import {db} from "./db";

export const contactUs = functions.https.onRequest(async (req, res) => {
  const name = req.body.name;
  const email = req.body.email;
  const message = req.body.message;

  const writeResult = await db.collection("inquiries").add({
    name: name,
    email: email,
    message: message,
  });

  res.json({result: `inquiry with ID: ${writeResult.id} added`});
});
