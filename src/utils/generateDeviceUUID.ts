import crypto from "crypto";

const DEVICE_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

export const generateDeviceUUID = (deviceId: string): string => {
  const hash = crypto
    .createHash("sha1")
    .update(DEVICE_NAMESPACE + deviceId)
    .digest("hex");

  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    "5" + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80)
      .toString(16)
      .padStart(2, "0") + hash.substring(18, 20),
    hash.substring(20, 32),
  ].join("-");
};
