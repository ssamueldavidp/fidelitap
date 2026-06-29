import 'package:flutter/material.dart';
import 'core/supabase_client.dart';
import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initSupabase();
  runApp(const FideliTapApp());
}
