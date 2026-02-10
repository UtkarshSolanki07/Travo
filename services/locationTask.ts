import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { database } from "./database";

export const LOCATION_TASK_NAME = "background-location-task";

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error("Background location task error:", error);
    return;
  }

  if (data) {
    const { locations } = data;
    const location = locations[0];

    if (location) {
      try {
        // Retrieve the stored user ID and interests
        const userId = await SecureStore.getItemAsync("current_user_id");
        const interestsStr = await SecureStore.getItemAsync("user_interests");
        const interests = interestsStr ? JSON.parse(interestsStr) : [];

        if (userId) {
          console.log("[Background Location Task]", location.coords);
          await database.updateLiveLocation(
            userId,
            location.coords.latitude,
            location.coords.longitude,
            interests,
          );
        } else {
          console.log("[Background Location Task] No user ID found");
        }
      } catch (err) {
        console.error("[Background Location Task] Error:", err);
      }
    }
  }
});
