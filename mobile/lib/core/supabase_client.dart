import 'package:supabase_flutter/supabase_flutter.dart';
import 'env.dart';

Future<void> initSupabase() async {
  await Supabase.initialize(
    url: Env.supabaseUrl,
    // ignore: deprecated_member_use
    anonKey: Env.supabaseAnonKey,
  );
}

SupabaseClient get supabase => Supabase.instance.client;
