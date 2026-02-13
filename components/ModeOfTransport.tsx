import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Text, View } from "react-native";

interface ModeOfTransportProps {
  distanceKm: number; // in kilometers
  driveDurationMin: number; // in minutes
  timeOfDay?: Date; // Optional: for time-based adjustments
}

const formatDuration = (minutes: number) => {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours} h ${mins > 0 ? `${mins} min` : ""}`.trim();
};

// Helper to determine if it's peak traffic time
const isPeakHour = (date: Date = new Date()) => {
  const hour = date.getHours();
  const day = date.getDay();

  // Weekend (0 = Sunday, 6 = Saturday)
  if (day === 0 || day === 6) return false;

  // Weekday peak hours: 7-9 AM and 5-7 PM
  return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
};

export default function ModeOfTransport({
  distanceKm,
  driveDurationMin,
  timeOfDay,
}: ModeOfTransportProps) {
  const modes = useMemo(() => {
    const currentTime = timeOfDay || new Date();
    const isRushHour = isPeakHour(currentTime);

    // ==================
    // CAR/DRIVE
    // ==================
    // GeoApify with traffic=approximated gives good baseline
    let carDuration = driveDurationMin;

    // Add traffic multiplier during peak hours
    if (isRushHour) {
      carDuration *= 1.3; // 30% slower in rush hour
    } else {
      carDuration *= 1.1; // 10% buffer for normal traffic
    }

    // Add parking time for destinations
    if (distanceKm > 2) {
      carDuration += 5; // 5 min parking time
    }

    // ==================
    // TRANSIT
    // ==================
    // Transit calculation: walking to/from stops + waiting + ride time
    let transitDuration;

    if (distanceKm < 1.5) {
      // Too short for transit to make sense - walking is probably faster
      transitDuration = driveDurationMin * 2.5;
    } else if (distanceKm < 5) {
      // Short transit: single bus/train likely
      transitDuration = driveDurationMin * 1.8 + 12; // wait time + walk to/from stops
    } else if (distanceKm < 15) {
      // Medium distance: might need transfer
      transitDuration = driveDurationMin * 1.6 + 15;
    } else {
      // Long distance: express routes more efficient
      transitDuration = driveDurationMin * 1.4 + 18;
    }

    // Peak hours: more frequent service but more crowded
    if (isRushHour) {
      transitDuration *= 0.95; // slightly faster due to frequency
    }

    // ==================
    // BIKE
    // ==================
    // Average cycling speeds vary by distance and terrain
    let bikeSpeed;

    if (distanceKm < 2) {
      bikeSpeed = 12; // Urban, lots of stops, traffic lights
    } else if (distanceKm < 8) {
      bikeSpeed = 16; // Steady urban cycling
    } else if (distanceKm < 15) {
      bikeSpeed = 18; // Sustained pace, fewer stops
    } else {
      bikeSpeed = 17; // Long distance, fatigue factor
    }

    let bikeDuration = (distanceKm / bikeSpeed) * 60;

    // Add time for bike parking/locking
    bikeDuration += 2;

    // Traffic affects cyclists too (more stops at lights)
    if (isRushHour && distanceKm < 10) {
      bikeDuration *= 1.1;
    }

    // ==================
    // WALK
    // ==================
    // Walking pace varies by distance and urban density
    let walkSpeed;

    if (distanceKm < 0.5) {
      walkSpeed = 4.0; // Short walk, more crossings
    } else if (distanceKm < 2) {
      walkSpeed = 4.5; // Typical urban walking
    } else if (distanceKm < 5) {
      walkSpeed = 5.0; // Sustained walking pace
    } else {
      walkSpeed = 4.8; // Long walk, fatigue factor
    }

    let walkDuration = (distanceKm / walkSpeed) * 60;

    // Add crossing time for longer walks (traffic lights)
    const numberOfCrossings = Math.floor(distanceKm * 4); // ~4 crossings per km
    walkDuration += numberOfCrossings * 0.5; // 30 sec avg per crossing

    return [
      {
        id: "car",
        icon: "car-outline" as const,
        label: "Drive",
        duration: carDuration,
        iconColor: "#3b82f6",
      },
      {
        id: "transit",
        icon: "bus-outline" as const,
        label: "Transit",
        duration: transitDuration,
        iconColor: "#10b981",
      },
      {
        id: "bike",
        icon: "bicycle-outline" as const,
        label: "Bike",
        duration: bikeDuration,
        iconColor: "#f97316",
      },
      {
        id: "walk",
        icon: "walk-outline" as const,
        label: "Walk",
        duration: walkDuration,
        iconColor: "#64748b",
      },
    ];
  }, [distanceKm, driveDurationMin, timeOfDay]);

  if (!distanceKm || !driveDurationMin) return null;

  return (
    <View className="flex-row justify-between w-full mt-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
      {modes.map((mode) => (
        <View key={mode.id} className="items-center justify-center flex-1">
          <View className="bg-white p-2 rounded-full shadow-sm mb-1">
            <Ionicons name={mode.icon} size={20} color={mode.iconColor} />
          </View>
          <Text className="text-xs font-bold text-slate-700">
            {formatDuration(mode.duration)}
          </Text>
          <Text className="text-[10px] text-slate-400 capitalize">
            {mode.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
