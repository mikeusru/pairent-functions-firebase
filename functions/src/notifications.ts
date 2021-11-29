/* eslint-disable max-len */
/**
 * Calculates amount of badge notifications the user has
 * @param {FirebaseFirestore.DocumentData} data The profile from the snapshot
 * @return {int} The percentage of the profile which is complete
 */
export function getNotificationAmount(data: FirebaseFirestore.DocumentData): number {
  let count = 0;

  if ("unseen_items" in data) {
    const unseenItems = data["unseen_items"];
    if ("messages" in unseenItems) {
      count = count + unseenItems["messages"].length;
    }
    if ("comments" in unseenItems) {
      count = count + unseenItems["comments"].length;
    }
    if ("posts" in unseenItems) {
      count = count + unseenItems["posts"].length;
    }
    if ("users" in unseenItems) {
      count = count + unseenItems["users"].length;
    }
  }

  return count;
}
