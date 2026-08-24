
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zeczodrgytxqesojpuds.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplY3pvZHJneXR4cWVzb2pwdWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NDMxMjMsImV4cCI6MjA3ODAxOTEyM30.QZFvswt6rCFU6LqMBw221G9u9vXCWO4J_Taktj2hlu4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
