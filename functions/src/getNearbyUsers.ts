/* eslint-disable max-len */
import * as functions from "firebase-functions";
import {geohashQueryBounds, distanceBetween} from "geofire-common";
import {db} from "./db";
const radiusInM = 1 * 1000;
const radiusArray = [
  radiusInM,
  radiusInM * 10,
  radiusInM * 25,
  radiusInM * 50,
  radiusInM * 100,
];

export const getNearbyUsers = functions.firestore.document("/profiles/{documentId}")
    .onCreate(async (snap, context) => {
      try {
        const location = snap.data().location;
        const geoPoint = location.geo_point;
        const center = [geoPoint.latitude, geoPoint.longitude];
        const snapshots = await queryByLocation(center);
        let matchingIDs = checkForFalsePositivesAndSort(snapshots, center);
        matchingIDs = removeUserIdFromArray(
            context.params.documentId,
            matchingIDs);
        await snap.ref.update({"top_picks": matchingIDs, "top_picks_loaded": true});
      } catch (error) {
        console.log(error);
      }
    });

export const getNearbyUsersOnRequest = functions.https.onRequest((req, res) => {

})

// eslint-disable-next-line require-jsdoc
async function queryByLocation(center: number[]): Promise<FireSnapshot[]> {
  let snapshots: FireSnapshot[] = [];
  for (const radius of radiusArray) {
    const bounds = geohashQueryBounds(center, radius);
    const promises = [];
    for (const b of bounds) {
      const q = db.collection("profiles")
          .orderBy("location.geo_hash")
          .startAt(b[0])
          .endAt(b[1]);
      promises.push(q.get());
    }
    // awaiting for all promises as opposed to each query
    // at a time allows for parallel behavior
    snapshots = await Promise.all(promises);
    for (const snap of snapshots) {
      console.log("Snapshot Size: ", snap.size);
    }
    const totalDocumentsInSnapshot = snapshots
        .reduce((sum, current) => sum + current.size, 0);
    console.log("queryByLocation found ",
        totalDocumentsInSnapshot, " snapshots for radius: ",
        radius);
    if (totalDocumentsInSnapshot > 50) {
      break;
    }
  }
  return snapshots;
}

  type DocData = FirebaseFirestore.DocumentData;
  type FireSnapshot = FirebaseFirestore.QuerySnapshot<DocData>

// eslint-disable-next-line require-jsdoc
function checkForFalsePositivesAndSort(snapshots: FireSnapshot[],
    center: number[]) {
  console.log("Checking for false positives");
  const idDistance: Array<{id: string, distance: number}> = [];
  for (const snap of snapshots) {
    for (const doc of snap.docs) {
      const location = doc.data().location;
      if ("geo_point" in location) {
        const geoPoint = location.geo_point;
        console.log("GeoPoint", geoPoint);
        const lat = geoPoint.latitude;
        const lng = geoPoint.longitude;
        const id = doc.id;
        // We have to filter out a few false positives due to GeoHash
        // accuracy, but most will match
        const distanceInKm = distanceBetween([lat, lng], center);
        const distanceInM = distanceInKm * 1000;
        if (distanceInM <= radiusArray[radiusArray.length - 1]) {
          idDistance.push({id: id, distance: distanceInM});
        }
      }
    }
  }
  idDistance.sort(function(a, b) {
    return a.distance - b.distance;
  });
  const matchingIDs = idDistance.map((x) => x.id);
  return matchingIDs;
}

// eslint-disable-next-line require-jsdoc
function removeUserIdFromArray(userID: string, idArray: string[]): string[] {
  const index = idArray.indexOf(userID);
  if (index > -1) {
    idArray.splice(index, 1);
  }
  return idArray;
}

