import { Cloudinary } from "@cloudinary/url-gen";
// // import { upload } from "cloudinary-react-native";

export const cld = new Cloudinary({
  cloud: {
    cloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME,
  },
  url: {
    secure: true,
  },
});

export const uploadToCloudinary = async (fileUri: string, resourceType: 'image' | 'video' = 'image') => {
  const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    throw new Error("Cloudinary cloud name is not defined in environment variables");
  }
  
  const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!uploadPreset) {
    throw new Error("Cloudinary upload preset is not defined in environment variables");
  }

  console.log('--- Cloudinary Upload Debug ---');
  console.log('Using Preset:', uploadPreset);
  console.log('Using Cloud Name:', cloudName);
  console.log('Resource Type:', resourceType);
  console.log('File URI:', fileUri.substring(0, 30) + '...');

  // Handle file name and extension
  const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
};
  // Handle file name and extension
  const filename = fileUri.split('/').pop() || 'upload';
  const match = /\.(\w+)$/.exec(filename);
  const ext = match?.[1]?.toLowerCase();
  const type = (ext && MIME_TYPES[ext]) || `${resourceType}/${ext || '*'}`;

  const formData = new FormData();
  // @ts-ignore
  formData.append("file", {
    uri: fileUri,
    type: type,
    name: filename,
  });
  formData.append("upload_preset", uploadPreset);
  formData.append("cloud_name", cloudName);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      {
        method: "POST",
        body: formData,
      }
    );
    const data = await response.json();
    if (data.error) {
      console.error("Cloudinary Error Details:", data.error);
      throw new Error(data.error.message);
    }
    return data.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
};

/**
 * Generates an optimized URL using Cloudinary transformations
 */
export const getOptimizedUrl = (url?: string, { width, height, crop = 'fill' }: { width?: number, height?: number, crop?: string } = {}) => {
  if (!url) return '';
  if (!url.includes('cloudinary.com')) return url;

  let transformation = 'f_auto,q_auto';
  if (width && height) {
    transformation += `,w_${width},h_${height},c_${crop}`;
  } else if (width) {
    transformation += `,w_${width},c_${crop}`;
  } else if (height) {
    transformation += `,h_${height},c_${crop}`;
  }

  return url.replace('/upload/', `/upload/${transformation}/`);
};

/**
 * Specifically for avatars - uses face detection cropping
 */
export const getAvatarUrl = (url?: string, size: number = 200) => {
  if (!url) return '';
  if (!url.includes('cloudinary.com')) return url;
 
  const transformation = `f_auto,q_auto,w_${size},h_${size},c_thumb,g_face`;
  return url.replace('/upload/', `/upload/${transformation}/`);
};

/**
 * Generates a thumbnail for a video
 */
export const getVideoThumbUrl = (url?: string, { width = 400, height = 400 } = {}) => {
  if (!url) return '';
  if (!url.includes('cloudinary.com')) return url;
  
  // Cloudinary allows changing extension to .jpg to get a frame
  const baseUrl = url.split('.').slice(0, -1).join('.') + '.jpg';
  const transformation = `f_auto,q_auto,w_${width},h_${height},c_fill,so_auto`;
  return baseUrl.replace('/upload/', `/upload/${transformation}/`);
};
