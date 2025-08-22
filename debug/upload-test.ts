// Test upload function - Add this to any screen temporarily for testing
import { getSupabase } from '@/lib/supabase';

const testUpload = async () => {
  try {
    // Test 1: Check auth
    const { data: { user }, error } = await getSupabase().auth.getUser();
    console.log('Auth test:', { user: user?.id, error });
    
    // Test 2: Check bucket access
    const { data: buckets, error: bucketError } = await getSupabase().storage.listBuckets();
    console.log('Buckets:', buckets, bucketError);
    
    // Test 3: List files in bucket
    const { data: files, error: listError } = await getSupabase().storage
      .from('event-banners')
      .list('events/' + user?.id);
    console.log('User folder:', files, listError);
    
  } catch (e) {
    console.log('Test error:', e);
  }
};

// Call testUpload() in your component to debug
