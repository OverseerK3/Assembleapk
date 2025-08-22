import * as FileSystem from 'expo-file-system';
import { getSupabase } from './supabase';

function guessContentTypeFromPath(p: string): string | undefined {
  const ext = (p.split('?')[0].split('#')[0].split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'heic':
    case 'heif':
      return 'image/heic';
    default:
      return undefined;
  }
}

async function getBlob(uri: string, fallbackType?: string): Promise<Blob> {
  // First try native fetch -> blob (works on Web, iOS file://, some Android URIs)
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    if (!blob || (blob as any).size === 0) throw new Error('empty blob');
    return blob;
  } catch {}

  // Robust fallback for React Native file:// or content:// URIs using base64 -> data URL -> blob
  if (uri.startsWith('file://') || uri.startsWith('content://')) {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const type = fallbackType || guessContentTypeFromPath(uri) || 'application/octet-stream';
    const dataUrl = `data:${type};base64,${base64}`;
    const res2 = await fetch(dataUrl);
    const blob2 = await res2.blob();
    if (!blob2 || (blob2 as any).size === 0) throw new Error('Failed to build blob from base64');
    return blob2;
  }

  throw new Error('Unsupported URI scheme for upload: ' + uri);
}

export async function uploadToBucket(params: { bucket: string; path: string; uri: string; contentType?: string }) {
  const { bucket, path, uri } = params;
  console.log('🔄 Starting upload:', { bucket, path, uri: uri.substring(0, 50) + '...' });
  
  const desiredType = params.contentType || guessContentTypeFromPath(uri) || guessContentTypeFromPath(path) || 'application/octet-stream';
  console.log('📁 Content type:', desiredType);
  
  try {
    const supabase = getSupabase();
    
    // Check auth status before upload
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated: ' + (authError?.message || 'No user'));
    }
    console.log('👤 User authenticated:', user.id);

    // For mobile devices, use base64 direct upload
    if (uri.startsWith('file://') || uri.startsWith('content://')) {
      console.log('📱 Using mobile base64 upload method...');
      
      try {
        // Read file as base64
        const base64 = await FileSystem.readAsStringAsync(uri, { 
          encoding: FileSystem.EncodingType.Base64 
        });
        console.log('✅ File read as base64, length:', base64.length);
        
        // Convert base64 directly to binary string for React Native
        const binaryString = atob(base64);
        console.log('✅ Binary string created, length:', binaryString.length);
        
        // Create a File-like object that works with Supabase
        const file = {
          name: path.split('/').pop() || 'upload.jpg',
          type: desiredType,
          size: binaryString.length,
          // Convert binary string to array buffer for upload
          arrayBuffer: async () => {
            const buffer = new ArrayBuffer(binaryString.length);
            const view = new Uint8Array(buffer);
            for (let i = 0; i < binaryString.length; i++) {
              view[i] = binaryString.charCodeAt(i);
            }
            return buffer;
          }
        };
        
        console.log('📦 File object created, uploading...');
        
        // Upload using the file object
        const { error } = await supabase.storage
          .from(bucket)
          .upload(path, file as any, { 
            upsert: true, 
            contentType: desiredType 
          });
          
        if (error) {
          console.log('❌ File object upload failed:', error);
          throw error;
        }
        
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        console.log('✅ Upload successful, public URL:', data.publicUrl);
        return data.publicUrl;
        
      } catch (mobileError) {
        console.log('❌ Mobile upload failed, trying base64 direct:', mobileError);
        
        // Last resort: try uploading base64 directly as text
        try {
          const base64 = await FileSystem.readAsStringAsync(uri, { 
            encoding: FileSystem.EncodingType.Base64 
          });
          
          // Upload base64 as raw data
          const { error } = await supabase.storage
            .from(bucket)
            .upload(path, base64, { 
              upsert: true, 
              contentType: 'application/octet-stream' 
            });
            
          if (error) throw error;
          
          const { data } = supabase.storage.from(bucket).getPublicUrl(path);
          console.log('✅ Base64 upload successful:', data.publicUrl);
          return data.publicUrl;
          
        } catch (base64Error) {
          console.log('❌ Base64 direct upload failed:', base64Error);
          // Fall through to standard method
        }
      }
    }
    
    // Fallback to standard blob method
    console.log('🌐 Using standard blob upload method...');
    const blob = await getBlob(uri, desiredType);
    console.log('✅ Blob created, size:', (blob as any).size);
    
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { upsert: true, contentType: desiredType });
      
    if (error) {
      console.log('❌ Blob upload failed:', error.message);
      throw error;
    }
    
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    console.log('✅ Upload successful, public URL:', data.publicUrl);
    return data.publicUrl;
  } catch (uploadError) {
    console.log('💥 Upload function error:', uploadError);
    throw uploadError;
  }
}

// Extract the internal storage path from a public URL
export function extractBucketPathFromPublicUrl(publicUrl: string, bucket: string): string | null {
  try {
    // Example: https://<proj>.supabase.co/storage/v1/object/public/event-banners/avatars/<uid>/avatar.jpg
    const marker = `/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.substring(idx + marker.length);
  } catch {
    return null;
  }
}

// Delete object from bucket by path
export async function deleteFromBucket(params: { bucket: string; path: string }) {
  const { bucket, path } = params;
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}
