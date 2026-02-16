import {
  database,
  type Activity,
  type ActivitySize,
  type ActivityVisibility,
} from "@/services/database";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface CreateActivityModalProps {
  visible: boolean;
  onClose: () => void;
  initialLocation?: {
    latitude: number;
    longitude: number;
    city?: string;
  };
  onActivityCreated?: () => void;
  onActivityUpdated?: () => void;
  initialData?: Activity;
}

const INTERESTS = [
  { icon: "fitness", label: "Fitness" },
  { icon: "restaurant", label: "Food" },
  { icon: "people", label: "Social" },
  { icon: "basketball", label: "Sports" },
  { icon: "color-palette", label: "Arts" },
  { icon: "musical-notes", label: "Music" },
  { icon: "airplane", label: "Travel" },
  { icon: "game-controller", label: "Gaming" },
  { icon: "book", label: "Learning" },
  { icon: "leaf", label: "Outdoor" },
  { icon: "hardware-chip", label: "Tech" },
  { icon: "ellipsis-horizontal", label: "Other" },
];

const SIZE_OPTIONS = [
  {
    value: "duo" as ActivitySize,
    icon: "people-outline",
    label: "Duo",
    subtitle: "2 people",
  },
  {
    value: "trio" as ActivitySize,
    icon: "people",
    label: "Trio",
    subtitle: "3 people",
  },
  {
    value: "group" as ActivitySize,
    icon: "people-circle",
    label: "Group",
    subtitle: "4+ people",
  },
];

const VISIBILITY_OPTIONS = [
  {
    value: "public" as ActivityVisibility,
    icon: "globe-outline",
    label: "Public",
    subtitle: "Anyone can join",
  },
  {
    value: "friends" as ActivityVisibility,
    icon: "people-outline",
    label: "Friends",
    subtitle: "Friends only",
  },
  {
    value: "invite_only" as ActivityVisibility,
    icon: "lock-closed-outline",
    label: "Private",
    subtitle: "Invite only",
  },
];

export default function CreateActivityModal({
  visible,
  onClose,
  initialLocation,
  onActivityCreated,
  onActivityUpdated,
  initialData,
}: CreateActivityModalProps) {
  const { user } = useUser();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activityType, setActivityType] = useState("");
  const [sizeType, setSizeType] = useState<ActivitySize>("group");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [startTime, setStartTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState("10");
  const [visibility, setVisibility] = useState<ActivityVisibility>(
    initialData?.visibility || "public",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form with initialData if editing
  useEffect(() => {
    if (initialData && visible) {
      setTitle(initialData.title);
      setDescription(initialData.description || "");
      setActivityType(initialData.activity_type || "");
      setSizeType(initialData.size_type);
      setSelectedInterests(initialData.interests || []);
      setStartTime(new Date(initialData.start_time));
      setMaxParticipants(initialData.max_participants.toString());
      setVisibility(initialData.visibility);
    } else if (!initialData && visible) {
      resetForm();
    }
  }, [initialData, visible]);

  const toggleInterest = (interest: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest],
    );
  };

  const selectionHaptic = () => {
    Haptics.selectionAsync();
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a title");
      return;
    }

    if (!initialData && !initialLocation) {
      Alert.alert("Error", "Location is required");
      return;
    }

    if (!user?.id) {
      Alert.alert("Error", "You must be logged in");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSubmitting(true);

    try {
      if (initialData) {
        await database.updateActivity(initialData.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          activity_type: activityType.trim() || undefined,
          size_type: sizeType,
          interests: selectedInterests.length > 0 ? selectedInterests : [],
          start_time: startTime.toISOString(),
          max_participants: Number.isFinite(parseInt(maxParticipants))
            ? parseInt(maxParticipants)
            : 10,
          visibility,
        });
        Alert.alert("Success", "Activity updated successfully!");
        await onActivityUpdated?.();
      } else {
        await database.createActivity({
          creator_id: user.id,
          title: title.trim(),
          description: description.trim() || undefined,
          activity_type: activityType.trim() || undefined,
          size_type: sizeType,
          interests:
            selectedInterests.length > 0 ? selectedInterests : undefined,
          start_time: startTime.toISOString(),
          latitude: initialLocation!.latitude,
          longitude: initialLocation!.longitude,
          city: initialLocation?.city,
          max_participants: Number.isFinite(parseInt(maxParticipants))
            ? parseInt(maxParticipants)
            : 10,
          visibility,
          status: "upcoming",
        });
        Alert.alert("Success", "Activity created successfully!");
        await onActivityCreated?.();
      }

      resetForm();
      onClose();
    } catch (error) {
      console.error("Failed to save activity:", error);
      Alert.alert(
        "Error",
        `Failed to ${initialData ? "update" : "create"} activity.`,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setActivityType("");
    setSizeType("group");
    setSelectedInterests([]);
    setStartTime(new Date());
    setMaxParticipants("10");
    setVisibility("public");
  };

  const formatDateTime = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    };
    return date.toLocaleString("en-US", options);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <LinearGradient
          colors={["#4f46e5", "#7c3aed"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onClose();
              }}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {initialData ? "Edit Activity" : "New Activity"}
            </Text>
            <TouchableOpacity
              onPress={handleCreate}
              disabled={isSubmitting}
              style={[styles.createButton, isSubmitting && { opacity: 0.5 }]}
            >
              <Text style={styles.createButtonText}>
                {isSubmitting ? "..." : initialData ? "Update" : "Create"}
              </Text>
            </TouchableOpacity>
          </View>

          {!initialData && initialLocation && (
            <View style={styles.locationBadge}>
              <View style={styles.locationIconWrapper}>
                <Ionicons name="location" size={18} color="white" />
              </View>
              <View style={styles.locationTextWrapper}>
                <Text style={styles.locationLabel}>Location Verified</Text>
                <Text style={styles.locationValue} numberOfLines={1}>
                  {initialLocation.city || "Selected location"}
                </Text>
              </View>
            </View>
          )}
        </LinearGradient>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.padding}>
            {/* Title & Description */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View
                  style={[styles.sectionIcon, { backgroundColor: "#eef2ff" }]}
                >
                  <Ionicons name="sparkles" size={20} color="#6366f1" />
                </View>
                <Text style={styles.sectionTitle}>What{"'"}s the plan?</Text>
              </View>

              <View style={styles.inputCard}>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Activity Title"
                  placeholderTextColor="#94a3b8"
                  style={styles.titleInput}
                  maxLength={100}
                />
                <View style={styles.divider} />
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Details..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  style={styles.descInput}
                  maxLength={500}
                />
              </View>
            </View>

            {/* Category & Time */}
            <View style={styles.row}>
              <View style={styles.flex1}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.simpleInput}>
                  <TextInput
                    value={activityType}
                    onChangeText={setActivityType}
                    placeholder="e.g., Sport"
                    placeholderTextColor="#cbd5e1"
                    style={styles.textInputBold}
                  />
                </View>
              </View>
              <View style={styles.flex1}>
                <Text style={styles.label}>Start Time</Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  style={styles.simpleInput}
                >
                  <View style={styles.rowBetween}>
                    <Text style={styles.textInputBold}>
                      {startTime.getHours()}:
                      {startTime.getMinutes().toString().padStart(2, "0")}
                    </Text>
                    <Ionicons name="time" size={18} color="#6366f1" />
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={styles.dateCard}
            >
              <View style={styles.rowBetween}>
                <View style={styles.rowCenter}>
                  <View style={styles.dateIconWrapper}>
                    <Ionicons name="calendar" size={20} color="#6366f1" />
                  </View>
                  <View>
                    <Text style={styles.dateLabel}>Scheduled For</Text>
                    <Text style={styles.dateValue}>
                      {formatDateTime(startTime)}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
              </View>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={startTime}
                mode="datetime"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setStartTime(date);
                }}
              />
            )}

            {/* Capacity */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View
                  style={[styles.sectionIcon, { backgroundColor: "#ecfdf5" }]}
                >
                  <Ionicons name="people" size={20} color="#10b981" />
                </View>
                <Text style={styles.sectionTitle}>Capacity</Text>
              </View>

              <View style={styles.row}>
                {SIZE_OPTIONS.map((size) => (
                  <TouchableOpacity
                    key={size.value}
                    onPress={() => {
                      selectionHaptic();
                      setSizeType(size.value);
                    }}
                    style={[
                      styles.sizeOption,
                      sizeType === size.value && styles.sizeOptionSelected,
                    ]}
                  >
                    <Ionicons
                      name={size.icon as any}
                      size={22}
                      color={sizeType === size.value ? "#10b981" : "#94a3b8"}
                    />
                    <Text
                      style={[
                        styles.sizeLabelSmall,
                        sizeType === size.value && { color: "#10b981" },
                      ]}
                    >
                      {size.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.capacityInput}>
                <View style={styles.flex1}>
                  <Text style={styles.labelSmall}>Maximum Members</Text>
                  <TextInput
                    value={maxParticipants}
                    onChangeText={setMaxParticipants}
                    keyboardType="number-pad"
                    style={styles.capacityValue}
                  />
                </View>
                <Ionicons name="person-add" size={20} color="#10b981" />
              </View>
            </View>

            {/* Interests */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View
                  style={[styles.sectionIcon, { backgroundColor: "#fff1f2" }]}
                >
                  <Ionicons name="heart" size={20} color="#f43f5e" />
                </View>
                <Text style={styles.sectionTitle}>Vibe & Interests</Text>
              </View>
              <View style={styles.tagContainer}>
                {INTERESTS.map((interest) => {
                  const isSelected = selectedInterests.includes(interest.label);
                  return (
                    <TouchableOpacity
                      key={interest.label}
                      onPress={() => toggleInterest(interest.label)}
                      style={[styles.tag, isSelected && styles.tagSelected]}
                    >
                      <Ionicons
                        name={interest.icon as any}
                        size={14}
                        color={isSelected ? "white" : "#64748b"}
                      />
                      <Text
                        style={[
                          styles.tagText,
                          isSelected && { color: "white" },
                        ]}
                      >
                        {interest.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Privacy */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View
                  style={[styles.sectionIcon, { backgroundColor: "#eff6ff" }]}
                >
                  <Ionicons name="shield-checkmark" size={20} color="#3b82f6" />
                </View>
                <Text style={styles.sectionTitle}>Privacy Setting</Text>
              </View>
              {VISIBILITY_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => {
                    selectionHaptic();
                    setVisibility(option.value);
                  }}
                  style={[
                    styles.privacyBox,
                    visibility === option.value && styles.privacyBoxSelected,
                  ]}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={22}
                    color={visibility === option.value ? "#3b82f6" : "#64748b"}
                  />
                  <View style={styles.privacyText}>
                    <Text style={styles.privacyLabel}>{option.label}</Text>
                    <Text style={styles.privacySub}>{option.subtitle}</Text>
                  </View>
                  {visibility === option.value && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#3b82f6"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Footer */}
            <TouchableOpacity onPress={handleCreate} disabled={isSubmitting}>
              <LinearGradient
                colors={["#4f46e5", "#7c3aed"]}
                style={styles.launchBtn}
              >
                <Text style={styles.launchBtnText}>
                  {isSubmitting
                    ? "Saving..."
                    : initialData
                      ? "Update Activity"
                      : "Launch Activity"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel and go back</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 25 },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  closeButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 10,
    borderRadius: 25,
  },
  headerTitle: { color: "white", fontSize: 22, fontWeight: "800" },
  createButton: {
    backgroundColor: "white",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 15,
  },
  createButtonText: { color: "#4f46e5", fontWeight: "800" },
  locationBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  locationIconWrapper: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 6,
    borderRadius: 10,
    marginRight: 12,
  },
  locationTextWrapper: { flex: 1 },
  locationLabel: {
    color: "white",
    opacity: 0.6,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  locationValue: { color: "white", fontSize: 13, fontWeight: "700" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 50 },
  padding: { paddingHorizontal: 20 },
  section: { marginTop: 30 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionIcon: { padding: 8, borderRadius: 12, marginRight: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  inputCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  titleInput: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginHorizontal: 20 },
  descInput: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 15,
    color: "#475569",
    minHeight: 120,
    textAlignVertical: "top",
  },
  row: { flexDirection: "row", gap: 12, marginTop: 20 },
  flex1: { flex: 1 },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  simpleInput: {
    backgroundColor: "white",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
    justifyContent: "center",
  },
  textInputBold: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowCenter: { flexDirection: "row", alignItems: "center" },
  dateCard: {
    backgroundColor: "#f5f7ff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e0e7ff",
    padding: 16,
    marginTop: 20,
  },
  dateIconWrapper: {
    backgroundColor: "white",
    padding: 8,
    borderRadius: 10,
    marginRight: 15,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6366f1",
    textTransform: "uppercase",
  },
  dateValue: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  sizeOption: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 15,
    alignItems: "center",
  },
  sizeOptionSelected: { backgroundColor: "#f0fdf4", borderColor: "#10b981" },
  sizeLabelSmall: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    marginTop: 8,
  },
  capacityInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginTop: 15,
  },
  labelSmall: {
    fontSize: 9,
    fontWeight: "800",
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  capacityValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 2,
  },
  tagContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  tagSelected: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  tagText: { fontSize: 13, fontWeight: "700", color: "#475569", marginLeft: 8 },
  privacyBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    padding: 18,
    marginBottom: 12,
  },
  privacyBoxSelected: {
    backgroundColor: "#f0f7ff",
    borderColor: "#3b82f6",
    borderWidth: 2,
  },
  privacyText: { flex: 1, marginLeft: 15 },
  privacyLabel: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  privacySub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  launchBtn: {
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  launchBtnText: { color: "white", fontSize: 18, fontWeight: "900" },
  cancelBtn: { alignItems: "center", padding: 20 },
  cancelBtnText: { color: "#94a3b8", fontWeight: "700", fontSize: 14 },
});
