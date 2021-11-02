import * as admin from "firebase-admin";
import * as express from "express";
import * as functions from "firebase-functions";

admin.initializeApp();

export {messageNotification} from "./messageNotification";
export {getNearbyUsers} from "./getNearbyUsers";
export {subscribe} from "./subscribe";
export {contactUs} from "./contact";

import {getNearbyUsersForUserId} from "./getNearbyUsers";
const app = express();
app.get("/nearby-users/:userID", getNearbyUsersForUserId);

exports.app = functions.https.onRequest(app);
