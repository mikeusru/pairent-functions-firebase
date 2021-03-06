/* eslint-disable require-jsdoc */
/* eslint-disable max-len */
import * as functions from "firebase-functions";
import {db} from "./db";
import {messaging} from "./messaging";
import * as _ from "lodash";
import {getNotificationAmount} from "./notifications";

type Payload = {
  notification: {
    title: string,
    body: string,
    sound: string,
    badge: string,
  },
  data: {
    conversationID: string,
    messageID: string,
    navigateTo: string,
  }
}

type UnseenMessage = {
  "conversation_id": string,
  "message_id": string,
}

export const messageNotification = functions.firestore.document("/chats/{conversationId}/thread/{messageId}")
    .onCreate(async (snap, context) => {
      const message = snap.data();
      const recipientIDs = message.recipient_ids;
      const senderName = message.sender_name;
      const notificationBody = (message.content);
      const docPromises = [];
      for (const id of recipientIDs) {
        const doc = db.doc("profiles/" + id).get();
        docPromises.push(doc);
      }
      const recipients = await Promise.all(docPromises);
      for (const recipient of recipients) {
        let recipientData = recipient.data();
        if (typeof recipientData != "undefined") {
          const id = recipient.id;
          recipientData = updateUnseenMessagesInProfile(id, recipientData, context.params.messageId, context.params.conversationId);
          const badgeCount = getNotificationAmount(recipientData);
          const fcmTokens = recipientData["fcm_tokens"];
          const payload: Payload = {
            notification: {
              title: senderName + " sent you a message.",
              body: notificationBody,
              sound: "default",
              badge: badgeCount.toString(),
            },
            data: {
              conversationID: context.params.conversationId,
              messageID: context.params.messageId,
              navigateTo: "chats",
            },
          };
          await sendNotifications(fcmTokens, payload, recipient.id);
        }
      }
    })
;

/** Update user's unseen notifications for the badge in their profile
 * @param {string} id the profile id
 * @param {FirebaseFirestore.DocumentData} data The profile from the snapshot
 * @param {string} messageID The message ID
 * @param {string} conversationID the conversation ID
 * @return {FirebaseFirestore.DocumentData}} updated data
 */
function updateUnseenMessagesInProfile(id: string, data: FirebaseFirestore.DocumentData, messageID: string, conversationID: string) {
  const unseenMessage: UnseenMessage = {
    "conversation_id": conversationID,
    "message_id": messageID};
  if ("unseen_items" in data) {
    const unseenItems = data["unseen_items"];
    if ("messages" in unseenItems) {
      unseenItems["messages"].push(unseenMessage);
    } else {
      unseenItems["messages"] = [unseenMessage];
    }
    db.doc("profiles/" + id).update({unseen_items: unseenItems});
    data["unseen_items"] = unseenItems;
    return data;
  } else {
    const unseenItems = {"messages": [unseenMessage]};
    db.doc("profiles/" + id).update({unseen_items: unseenItems});
    data["unseen_items"] = unseenItems;
    return data;
  }
}

// Send notifications, and if any of the tokens don't work, remove them from the user profile
async function sendNotifications(fcmTokens: string[], payload: Payload, recipientId: string) {
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
      db.doc("profiles/" + recipientId).update({
        fcm_tokens: stillRegisteredTokens,
      });
    }
  });
}
