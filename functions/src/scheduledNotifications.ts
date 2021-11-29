/* eslint-disable max-len */

import * as functions from "firebase-functions";
import {db} from "./db";
import * as _ from "lodash";
import {sprintf} from "sprintf-js";
import {messaging} from "./messaging";
import {getNotificationAmount} from "./notifications";

type Payload = {
    notification: {
      title: string,
      body: string,
      sound: string,
      badge: string,
    },
    data: {
      percentComplete: string,
      navigateTo: string,
    }
  }

export const remindUsersToUpdateProfile = functions.pubsub.schedule("every tuesday 12:00").onRun(async () => {
  console.log("running remindUsersToUpdateProfile");
  // go through all users
  const snapshot = await db.collection("profiles").get();
  // for each user, check if profile is complete. if not, send them a reminder to complete their profile
  snapshot.forEach((doc) => {
    const data = doc.data();
    const percentComplete = getPercentComplete(data);
    if (percentComplete < 100) {
      notifyUserToCompleteProfile(doc.id, data, percentComplete);
    }
  });
  return null;
});

/**
 * Calculates percentage of the profile that's complete
 * @param {FirebaseFirestore.DocumentData} data The profile from the snapshot
 * @return {int} The percentage of the profile which is complete
 */
function getPercentComplete(data: FirebaseFirestore.DocumentData): number {
  const percentCalc = new PercentageCompleteCalculator();
  percentCalc.incrementIfTrue("bio" in data && data["bio"] != "");
  percentCalc.incrementIfTrue("bio_long" in data && data["bio_long"] != "");
  percentCalc.incrementIfTrue("location" in data);
  percentCalc.incrementIfTrue("match_profile" in data);
  percentCalc.incrementIfTrue(data["profile_images"].length != 0);
  percentCalc.incrementIfTrue("bio" in data && data["bio"] != "");
  return percentCalc.getPercentComplete();
}


/**
 *
 */
class PercentageCompleteCalculator {
  private total: number;
  private complete: number;

  /**
   * Initialize total and complete to 0
   */
  constructor() {
    this.total = 0.0;
    this.complete = 0.0;
  }

  /**
   * If true, incremets total and complete values. If false, increments only total value.
   * @param {boolean} valueExists True if profile value is filled out, false if not
   */
  incrementIfTrue(valueExists: boolean) {
    this.total = this.total + 1;
    if (valueExists) {
      this.complete = this.complete + 1;
    }
  }

  /**
   * return percentage complete, calculated by complete/total
   * @return {int} percent complete (0 - 100)
   */
  getPercentComplete() {
    return Math.round(this.complete / this.total * 100);
  }
}

/**
 * Send a notification to the user that their profile is incomplete
 * @param {string} id firebase document id for profile
 * @param {FirebaseFirestore.DocumentData} data profile data from firebase
 * @param {int} percent Percent profile complete (0-100)
 */
async function notifyUserToCompleteProfile(id: string, data: FirebaseFirestore.DocumentData, percent: number) {
  const fcmTokens = data["fcm_tokens"];
  const badgeCount = getNotificationAmount(data);
  const payload: Payload = {
    notification: {
      title: "Complete your Pairent profile!",
      body: sprintf("Your profile is %d%% complete. Show yourself off by completing your profile!", percent),
      sound: "default",
      badge: badgeCount.toString(),
    },
    data: {
      percentComplete: percent.toString(),
      navigateTo: "profile",
    },
  };
  messaging().sendToDevice(fcmTokens, payload).then( (response) => {
    const stillRegisteredTokens = fcmTokens;
    response.results.forEach((result, index) => {
      const error = result.error;
      const failedToken = fcmTokens[index];
      if (error) {
        console.error("Problem with sending message to device with token ", failedToken, error);
        if (error.code === "messaging/invalid-registration-token" ||
        error.code === "messaging/registration-token-not-registered") {
          const failedIndex = stillRegisteredTokens.indexOf(failedToken);
          if (failedIndex > -1) {
            stillRegisteredTokens.splice(failedIndex, 1);
          }
        }
      }
    });
    if (!(_.isEqual(fcmTokens.sort(), stillRegisteredTokens.sort()))) {
      console.log("Updating user fcm tokens");
      db.doc("profiles/" + id).update({
        fcm_tokens: stillRegisteredTokens,
      });
    }
  });
}
