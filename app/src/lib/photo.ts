import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { notify } from './confirm';

/** Photos are resized on the device before upload: small, fast, well under the 5 MB limit. */
const PHOTO_WIDTH = 800;

/**
 * Lets the user choose (or take) a photo, cropped square and resized to a
 * JPEG. Returns a local file URI ready for upload, or null if cancelled.
 */
export async function pickPhoto(source: 'library' | 'camera'): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 };
  if (source === 'camera') {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      notify('Camera access needed', 'Allow camera access in Settings to take a photo.');
      return null;
    }
  }
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const uri = result.canceled ? undefined : result.assets[0]?.uri;
  if (!uri) return null;
  const image = await ImageManipulator.manipulate(uri).resize({ width: PHOTO_WIDTH }).renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return saved.uri;
}
