import { database, type Activity } from "@/services/database";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

interface ActivityDetailsModalProps {
  activity: Activity | null;
  visible: boolean;
  onClose: () => void;
}

export default function ActivityDetailsModal({
  activity,
  visible,
  onClose,
}: ActivityDetailsModalProps) {
  const { user: clerkUser } = useUser();
  const [participants, setParticipants] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userStatus, setUserStatus] = useState<"none" | "pending" | "approved">(
    "none",
  );
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!activity || !clerkUser) return;
    setLoading(true);
    try {
      const isAdminUser = activity.creator_id === clerkUser.id;
      setIsAdmin(isAdminUser);

      const [pData, rData, status] = await Promise.all([
        database.getActivityParticipants(activity.id),
        isAdminUser
          ? database.getJoinRequests(activity.id, clerkUser.id)
          : Promise.resolve([]),
        database.getParticipantStatus(activity.id, clerkUser.id),
      ]);

      setParticipants(pData);
      setRequests(rData);
      setUserStatus(status);
    } catch (error) {
      console.error("fetchData error:", error);
    } finally {
      setLoading(false);
    }
  }, [activity, clerkUser]);

  useEffect(() => {
    if (visible && activity) {
      fetchData();
    }
  }, [visible, activity, fetchData]);

  const handleJoinRequest = async () => {
    if (!activity || !clerkUser) return;
    setActionLoading(true);
    try {
      await database.requestToJoinActivity(activity.id, clerkUser.id);
      Alert.alert(
        "Request Sent",
        "Your request to join has been sent to the admin.",
      );
      fetchData();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send request");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!activity || !clerkUser) return;
    setActionLoading(true);
    try {
      await database.leaveActivity(activity.id, clerkUser.id);
      Alert.alert("Left Activity", "You have left the activity.");
      fetchData();
    } catch (error) {
      console.error("handleLeave error:", error);
      Alert.alert("Error", "Failed to leave activity");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (requesterId: string) => {
    if (!activity || !clerkUser) return;
    try {
      await database.approveJoinRequest(activity.id, requesterId, clerkUser.id);
      fetchData();
    } catch (error) {
      console.error("handleApprove error:", error);
      Alert.alert("Error", "Failed to approve request");
    }
  };

  const handleReject = async (requesterId: string) => {
    if (!activity || !clerkUser) return;
    try {
      await database.rejectJoinRequest(activity.id, requesterId, clerkUser.id);
      fetchData();
    } catch (error) {
      console.error("handleReject error:", error);
      Alert.alert("Error", "Failed to reject request");
    }
  };

  if (!activity) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl h-[90%] overflow-hidden">
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 py-4 border-b border-slate-100">
            <Text className="text-xl font-bold text-slate-900">
              Activity Details
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-6 py-4">
            {loading ? (
              <View className="flex-1 items-center justify-center py-20">
                <ActivityIndicator size="large" color="#6366f1" />
              </View>
            ) : (
              <>
                {/* Main Info */}
                <View className="mb-6">
                  <Text className="text-2xl font-bold text-slate-900 mb-2">
                    {activity.title}
                  </Text>
                  <View className="flex-row items-center mb-2">
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color="#6366f1"
                    />
                    <Text className="text-slate-600 ml-2">
                      {format(
                        new Date(activity.start_time),
                        "EEEE, MMMM do, h:mm a",
                      )}
                    </Text>
                  </View>
                  {activity.city && (
                    <View className="flex-row items-center mb-2">
                      <Ionicons
                        name="location-outline"
                        size={18}
                        color="#6366f1"
                      />
                      <Text className="text-slate-600 ml-2">
                        {activity.city}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Description */}
                {activity.description && (
                  <View className="mb-6">
                    <Text className="text-sm font-bold text-slate-900 uppercase mb-2">
                      About
                    </Text>
                    <Text className="text-slate-600 leading-5">
                      {activity.description}
                    </Text>
                  </View>
                )}

                {/* Status & Participants Summary */}
                <View className="flex-row mb-6 bg-slate-50 p-4 rounded-2xl">
                  <View className="flex-1">
                    <Text className="text-xs text-slate-400 font-bold uppercase">
                      Participants
                    </Text>
                    <Text className="text-lg font-bold text-slate-900">
                      {participants.length} / {activity.max_participants}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-slate-400 font-bold uppercase">
                      Visibility
                    </Text>
                    <Text className="text-lg font-bold text-slate-900 capitalize">
                      {activity.visibility}
                    </Text>
                  </View>
                </View>

                {/* Join/Leave Actions (for non-admins) */}
                {!isAdmin && (
                  <View className="mb-6">
                    {userStatus === "approved" ? (
                      <TouchableOpacity
                        onPress={handleLeave}
                        disabled={actionLoading}
                        className="bg-red-50 py-4 rounded-2xl items-center border border-red-100"
                      >
                        <Text className="text-red-600 font-bold text-base">
                          Leave Activity
                        </Text>
                      </TouchableOpacity>
                    ) : userStatus === "pending" ? (
                      <View className="bg-yellow-50 py-4 rounded-2xl items-center border border-yellow-100">
                        <Text className="text-yellow-700 font-bold text-base">
                          Request Pending
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={handleJoinRequest}
                        disabled={
                          actionLoading ||
                          participants.length >= activity.max_participants
                        }
                        className={`py-4 rounded-2xl items-center ${
                          participants.length >= activity.max_participants
                            ? "bg-slate-200"
                            : "bg-indigo-600"
                        }`}
                      >
                        <Text className="text-white font-bold text-base">
                          {participants.length >= activity.max_participants
                            ? "Activity Full"
                            : "Request to Join"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Admin Panel */}
                {isAdmin && (
                  <View className="mb-6">
                    <Text className="text-base font-bold text-slate-900 mb-4">
                      Admin Dashboard
                    </Text>

                    {/* Join Requests */}
                    <View className="mb-4">
                      <Text className="text-xs text-slate-400 font-bold uppercase mb-2">
                        Pending Requests ({requests.length})
                      </Text>
                      {requests.length === 0 ? (
                        <Text className="text-slate-400 text-sm italic">
                          No pending requests
                        </Text>
                      ) : (
                        requests.map((req) => (
                          <View
                            key={req.user_id}
                            className="flex-row items-center justify-between py-3 border-b border-slate-50"
                          >
                            <View className="flex-row items-center">
                              <Image
                                source={{
                                  uri:
                                    req.user?.avatar_url ||
                                    "https://via.placeholder.com/150",
                                }}
                                className="w-10 h-10 rounded-full bg-slate-100"
                              />
                              <View className="ml-3">
                                <Text className="text-sm font-bold text-slate-900">
                                  {req.user?.display_name || "User"}
                                </Text>
                                <Text className="text-xs text-slate-500">
                                  @{req.user?.username}
                                </Text>
                              </View>
                            </View>
                            <View className="flex-row gap-2">
                              <TouchableOpacity
                                onPress={() => handleReject(req.user_id)}
                                className="p-2 bg-red-50 rounded-full"
                              >
                                <Ionicons
                                  name="close"
                                  size={18}
                                  color="#ef4444"
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => handleApprove(req.user_id)}
                                className="p-2 bg-green-50 rounded-full"
                              >
                                <Ionicons
                                  name="checkmark"
                                  size={18}
                                  color="#10b981"
                                />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                )}

                {/* Participants List */}
                <View className="mb-10">
                  <Text className="text-sm font-bold text-slate-900 uppercase mb-4">
                    Confirmed Participants
                  </Text>
                  {participants.length === 0 ? (
                    <Text className="text-slate-400 text-sm italic">
                      No participants yet
                    </Text>
                  ) : (
                    participants.map((p) => (
                      <View
                        key={p.user_id}
                        className="flex-row items-center mb-4"
                      >
                        <Image
                          source={{
                            uri:
                              p.user?.avatar_url ||
                              "https://via.placeholder.com/150",
                          }}
                          className="w-12 h-12 rounded-full bg-slate-100"
                        />
                        <View className="ml-4">
                          <Text className="text-sm font-bold text-slate-900">
                            {p.user?.display_name || "User"}{" "}
                            {p.user_id === activity.creator_id && (
                              <Text className="text-indigo-600 font-normal">
                                (Admin)
                              </Text>
                            )}
                          </Text>
                          <Text className="text-xs text-slate-500">
                            @{p.user?.username}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
