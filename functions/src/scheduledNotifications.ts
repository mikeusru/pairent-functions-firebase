/* eslint-disable max-len */

import * as functions from "firebase-functions";
import {db} from "./db";
import {messaging} from "./messaging";
import * as _ from "lodash";

type Payload = {
    notification: {
      title: string,
      body: string,
      sound: string,
    },
    data: {
      percentComplete: string,
    }
  }

export const remindUsersToUpdateProfile = functions.pubsub.schedule("every Tuesday at 12:00").onRun(async (context) => {
  console.log("running remindUsersToUpdateProfile");
  // go through all users
  // for each user, check if profile is complete. if not, send them a reminder to complete their profile
  return null;
});

